const express = require('express');
const { rateLimit } = require('express-rate-limit');
const db = require('../db');
const { verifyPassword } = require('../auth');
const { parseUbication, haversine } = require('../geo');
const { optimizeRoute } = require('../graph');

const router = express.Router();

const MAX_ROUTE_NODES = 100;
const MAX_ROUTE_NAME = 100;

// Solo cuentan los intentos fallidos: frena la fuerza bruta sin molestar a quien entra bien.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.' },
});

function requireUser(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Debes iniciar sesión' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Se requiere un usuario administrador' });
  }
  next();
}

function isValidNodeIdList(nodeIds) {
  return (
    Array.isArray(nodeIds) &&
    nodeIds.length >= 2 &&
    nodeIds.length <= MAX_ROUTE_NODES &&
    nodeIds.every((id) => Number.isInteger(id) && id > 0) &&
    new Set(nodeIds).size === nodeIds.length
  );
}

const NODE_IDS_ERROR = `Seleccione entre 2 y ${MAX_ROUTE_NODES} lugares distintos`;

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

function normalizeText(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function findCoordsById(nodeIds) {
  const placeholders = nodeIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT id, ubication FROM nodes WHERE id IN (${placeholders})`)
    .all(...nodeIds);

  const coordsById = new Map();
  for (const row of rows) {
    const c = parseUbication(row.ubication);
    if (c) coordsById.set(row.id, c);
  }
  return coordsById;
}

const NODE_WITH_CATEGORY_SELECT = `
  SELECT nodes.id, nodes.code, nodes.label, nodes.desc, nodes.ubication, types.name AS category
  FROM nodes LEFT JOIN types ON types.id = nodes.type_id
`;

// ----- Sesion -----

router.post('/login', loginLimiter, (req, res, next) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  const row = db
    .prepare('SELECT id, names, surnames, role, password_hash, salt FROM users WHERE username = ?')
    .get(username);

  if (!row || !row.salt || !verifyPassword(password, row.salt, row.password_hash)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  // Nueva sesion tras autenticar: evita la fijacion de sesion.
  req.session.regenerate((err) => {
    if (err) return next(err);

    req.session.user = {
      id: row.id,
      username,
      nombreCompleto: `${row.names} ${row.surnames}`,
      role: row.role,
    };

    res.json({ ok: true, user: req.session.user });
  });
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
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
  const q = normalizeText(req.query.q).trim();
  if (!q) return res.json([]);

  // SQLite LIKE no ignora acentos ("volcan" no encontraria "Volcán"), asi que se filtra aqui.
  const rows = db
    .prepare(NODE_WITH_CATEGORY_SELECT)
    .all()
    .filter((row) => normalizeText(row.label).includes(q))
    .slice(0, 15);

  res.json(rows.map(({ ubication, ...rest }) => rest));
});

router.get('/nodes', (req, res) => {
  const type = req.query.type;
  const rows = typeof type === 'string'
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
    .filter((v) => Number.isInteger(v) && v > 0)
    .slice(0, MAX_ROUTE_NODES);

  if (ids.length === 0) return res.json([]);

  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(`${NODE_WITH_CATEGORY_SELECT} WHERE nodes.id IN (${placeholders})`)
    .all(...ids);

  res.json(rows.map(nodeToCoord));
});

// ----- Calculo de ruta optimizada -----

router.post('/route/compute', (req, res) => {
  const { nodeIds } = req.body || {};

  if (!isValidNodeIdList(nodeIds)) {
    return res.status(400).json({ error: NODE_IDS_ERROR });
  }

  const coordsById = findCoordsById(nodeIds);
  if (coordsById.size !== nodeIds.length) {
    return res.status(400).json({ error: 'Algún lugar no existe o no tiene coordenadas válidas' });
  }

  const distanceFn = (a, b) => {
    const ca = coordsById.get(a);
    const cb = coordsById.get(b);
    return haversine(ca.lat, ca.lon, cb.lat, cb.lon);
  };

  res.json(optimizeRoute(nodeIds, distanceFn));
});

// ----- Rutas guardadas -----

router.get('/routes', (req, res) => {
  if (!req.session.user) return res.json([]);

  const rows = db
    .prepare('SELECT id, name, created_at FROM user_routes WHERE user_id = ? ORDER BY created_at DESC, id DESC')
    .all(req.session.user.id);

  res.json(rows);
});

router.get('/routes/:id', requireUser, (req, res) => {
  const routeId = Number(req.params.id);

  // Mismo 404 para "no existe" y "es de otro usuario": no revela que rutas existen.
  const route = Number.isInteger(routeId)
    ? db
        .prepare('SELECT id FROM user_routes WHERE id = ? AND user_id = ?')
        .get(routeId, req.session.user.id)
    : null;
  if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });

  const edgeRows = db
    .prepare('SELECT from_node_id, to_node_id FROM user_route_edges WHERE user_route_id = ? ORDER BY id')
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
  const { nodeIds } = req.body || {};
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

  if (!name || name.length > MAX_ROUTE_NAME) {
    return res.status(400).json({ error: `El nombre es requerido (máximo ${MAX_ROUTE_NAME} caracteres)` });
  }
  if (!isValidNodeIdList(nodeIds)) {
    return res.status(400).json({ error: NODE_IDS_ERROR });
  }
  if (findCoordsById(nodeIds).size !== nodeIds.length) {
    return res.status(400).json({ error: 'Algún lugar no existe o no tiene coordenadas válidas' });
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
    res.json({ ok: true, id: Number(lastInsertRowid) });
  } catch (err) {
    db.exec('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'No se pudo guardar la ruta' });
  }
});

// ----- Administracion de lugares -----

router.get('/admin/nodes', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT id, code, label, desc, ubication, type_id FROM nodes ORDER BY id').all();
  res.json(rows);
});

function validateNodePayload({ code, label, desc, ubication, type_id }) {
  if (typeof code !== 'string' || !code.trim()) return 'El código es requerido';
  if (typeof label !== 'string' || !label.trim()) return 'El nombre es requerido';
  if (desc !== undefined && desc !== null && typeof desc !== 'string') return 'Descripción inválida';
  if (typeof ubication !== 'string' || !parseUbication(ubication)) {
    return 'Ubicación inválida: usa el formato "latitud,longitud"';
  }
  if (!Number.isInteger(type_id) || !db.prepare('SELECT 1 FROM types WHERE id = ?').get(type_id)) {
    return 'Tipo inválido';
  }
  return null;
}

router.put('/admin/nodes/:id', requireAdmin, (req, res) => {
  const body = req.body || {};
  const id = Number(req.params.id);

  const validationError = validateNodePayload(body);
  if (validationError) return res.status(400).json({ error: validationError });

  const code = body.code.trim();
  const duplicate = db.prepare('SELECT 1 FROM nodes WHERE code = ? AND id <> ?').get(code, id);
  if (duplicate) return res.status(409).json({ error: 'Ya existe otro lugar con ese código' });

  const { changes } = db
    .prepare('UPDATE nodes SET code = ?, label = ?, desc = ?, ubication = ?, type_id = ? WHERE id = ?')
    .run(code, body.label.trim(), body.desc ?? null, body.ubication.trim(), body.type_id, id);

  if (changes === 0) return res.status(404).json({ error: 'Lugar no encontrado' });
  res.json({ ok: true });
});

module.exports = router;
