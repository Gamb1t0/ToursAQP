const express = require('express');
const db = require('../db');
const { verifyPassword } = require('../auth');
const { parseUbication, haversine } = require('../geo');
const { nearestNeighborRoute } = require('../graph');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Se requiere un usuario administrador' });
  }
  next();
}

function nodeToCoord(row) {
  const coords = parseUbication(row.ubication);
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    desc: row.desc ?? null,
    category: row.category ?? null,
    lat: coords ? coords.lat : null,
    lon: coords ? coords.lon : null,
  };
}

const NODE_WITH_CATEGORY_SELECT = `
  SELECT nodes.id, nodes.code, nodes.label, nodes.desc, nodes.ubication, types.name AS category
  FROM nodes LEFT JOIN types ON types.id = nodes.type_id
`;

// ----- Sesion -----

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contrasena son requeridos' });
  }

  const row = db
    .prepare('SELECT id, names, surnames, role, password_hash, salt FROM users WHERE username = ?')
    .get(username);

  if (!row || !row.salt || !verifyPassword(password, row.salt, row.password_hash)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  req.session.user = {
    id: row.id,
    username,
    nombreCompleto: `${row.names} ${row.surnames}`,
    role: row.role,
  };

  res.json({ ok: true, user: req.session.user });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/session', (req, res) => {
  res.json({ user: req.session.user || null });
});

// ----- Lugares -----

router.get('/types', (req, res) => {
  const rows = db.prepare('SELECT id, name, description FROM types ORDER BY name').all();
  res.json(rows);
});

router.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);

  const rows = db
    .prepare(`${NODE_WITH_CATEGORY_SELECT} WHERE nodes.label LIKE ? LIMIT 15`)
    .all(`%${q}%`);

  res.json(rows.map(({ ubication, ...rest }) => rest));
});

router.get('/nodes', (req, res) => {
  const type = req.query.type;
  const rows = type
    ? db.prepare(`${NODE_WITH_CATEGORY_SELECT} WHERE types.name = ?`).all(type)
    : db.prepare(NODE_WITH_CATEGORY_SELECT).all();

  res.json(rows.map(({ ubication, ...rest }) => rest));
});

router.get('/nodes/all', (req, res) => {
  const rows = db.prepare(NODE_WITH_CATEGORY_SELECT).all();
  res.json(rows.map(nodeToCoord).filter((n) => n.lat !== null));
});

router.get('/nodes/coords', (req, res) => {
  const ids = String(req.query.ids || '')
    .split(',')
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v));

  if (ids.length === 0) return res.json([]);

  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(`${NODE_WITH_CATEGORY_SELECT} WHERE nodes.id IN (${placeholders})`)
    .all(...ids);

  res.json(rows.map(nodeToCoord));
});

// ----- Calculo de ruta optima -----

router.post('/route/compute', (req, res) => {
  const { nodeIds } = req.body || {};

  if (!Array.isArray(nodeIds) || nodeIds.length < 2) {
    return res.status(400).json({ error: 'Seleccione al menos 2 nodos' });
  }

  const placeholders = nodeIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT id, ubication FROM nodes WHERE id IN (${placeholders})`)
    .all(...nodeIds);

  const coordsById = new Map();
  for (const row of rows) {
    const c = parseUbication(row.ubication);
    if (c) coordsById.set(row.id, c);
  }

  const distanceFn = (a, b) => {
    const ca = coordsById.get(a);
    const cb = coordsById.get(b);
    if (!ca || !cb) return Infinity;
    return haversine(ca.lat, ca.lon, cb.lat, cb.lon);
  };

  const { order, totalDistance } = nearestNeighborRoute(nodeIds, distanceFn);
  res.json({ order, totalDistance });
});

// ----- Rutas guardadas -----

router.get('/routes', (req, res) => {
  if (!req.session.user) return res.json([]);

  const rows = db
    .prepare('SELECT id, name, created_at FROM user_routes WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.session.user.id);

  res.json(rows);
});

router.get('/routes/:id', (req, res) => {
  const routeId = Number(req.params.id);

  const edgeRows = db
    .prepare('SELECT from_node_id, to_node_id FROM user_route_edges WHERE user_route_id = ?')
    .all(routeId);

  const nodeIds = [...new Set(edgeRows.flatMap((e) => [e.from_node_id, e.to_node_id]))];
  if (nodeIds.length === 0) return res.json({ nodes: [], edges: [] });

  const placeholders = nodeIds.map(() => '?').join(',');
  const nodeRows = db
    .prepare(`${NODE_WITH_CATEGORY_SELECT} WHERE nodes.id IN (${placeholders})`)
    .all(...nodeIds);

  res.json({
    nodes: nodeRows.map(nodeToCoord),
    edges: edgeRows.map((e) => ({ from: e.from_node_id, to: e.to_node_id })),
  });
});

router.post('/routes', requireAdmin, (req, res) => {
  const { name, nodeIds } = req.body || {};

  if (!name || !Array.isArray(nodeIds) || nodeIds.length < 2) {
    return res.status(400).json({ error: 'Nombre y al menos 2 nodos son requeridos' });
  }

  const insertRoute = db.prepare('INSERT INTO user_routes (user_id, name) VALUES (?, ?)');
  const insertEdge = db.prepare(
    'INSERT INTO user_route_edges (user_route_id, from_node_id, to_node_id) VALUES (?, ?, ?)'
  );

  db.exec('BEGIN');
  try {
    const { lastInsertRowid } = insertRoute.run(req.session.user.id, name);
    for (let i = 0; i < nodeIds.length - 1; i++) {
      insertEdge.run(lastInsertRowid, nodeIds[i], nodeIds[i + 1]);
    }
    db.exec('COMMIT');
    res.json({ ok: true, id: lastInsertRowid });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'No se pudo guardar la ruta' });
  }
});

// ----- Administracion de nodos -----

router.get('/admin/nodes', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT id, code, label, desc, ubication, type_id FROM nodes ORDER BY id').all();
  res.json(rows);
});

router.put('/admin/nodes/:id', requireAdmin, (req, res) => {
  const { code, label, desc, ubication, type_id } = req.body || {};
  const id = Number(req.params.id);

  db.prepare(
    'UPDATE nodes SET code = ?, label = ?, desc = ?, ubication = ?, type_id = ? WHERE id = ?'
  ).run(code, label, desc, ubication, type_id, id);

  res.json({ ok: true });
});

module.exports = router;
