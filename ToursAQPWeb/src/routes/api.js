const express = require('express');
const { rateLimit } = require('express-rate-limit');
const db = require('../db');
const { verifyPassword, generateSalt, hashPassword } = require('../auth');
const { parseUbication, haversine } = require('../geo');
const { optimizeOrder } = require('../graph');
const { isValidProfile, getDurationMatrix, getDirections } = require('../routing');

const router = express.Router();

const MAX_ROUTE_NODES = 25;
const MAX_ROUTE_NAME = 100;
const MAX_ROUTES_PER_USER = 50;
const MAX_DISPLAY_NAME = 60;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;
const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

// Frena la creacion masiva de cuentas desde una misma conexion. Solo cuentan las
// cuentas creadas: equivocarse al llenar el formulario no debe bloquear a nadie.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  skipFailedRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Se crearon demasiadas cuentas desde esta conexión. Intenta más tarde.' },
});
const WALKING_SECONDS_PER_METER = 0.72; // ~5 km/h, solo para el calculo en linea recta

// Cada calculo consulta un servicio publico externo: se limita por visitante.
const routingLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados cálculos de ruta. Espera un momento.' },
});

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

function straightDistance(a, b) {
  return haversine(a.lat, a.lon, b.lat, b.lon);
}

// Sin servicio de rutas no se conocen las calles: se devuelve la linea recta y routed=false
// para que la interfaz avise al usuario de que es solo una aproximacion.
function straightLineRoute(coords, profile) {
  const legs = coords.slice(1).map((c, i) => {
    const distance = straightDistance(coords[i], c);
    return { distance, duration: profile === 'foot' ? distance * WALKING_SECONDS_PER_METER : null };
  });

  return {
    routed: false,
    distance: legs.reduce((sum, leg) => sum + leg.distance, 0),
    duration: profile === 'foot' ? legs.reduce((sum, leg) => sum + leg.duration, 0) : null,
    geometry: coords.map((c) => [c.lat, c.lon]),
    legs,
  };
}

async function buildRoute(order, coordsById, profile) {
  const coords = order.map((id) => coordsById.get(id));
  try {
    return { routed: true, ...(await getDirections(coords, profile)) };
  } catch (err) {
    console.error('Servicio de rutas no disponible:', err.message);
    return straightLineRoute(coords, profile);
  }
}

async function computeBestOrder(nodeIds, coordsById, profile) {
  const coords = nodeIds.map((id) => coordsById.get(id));
  let matrix = null;
  try {
    matrix = await getDurationMatrix(coords, profile);
  } catch (err) {
    console.error('Servicio de rutas no disponible:', err.message);
  }

  const indexById = new Map(nodeIds.map((id, i) => [id, i]));
  const costFn = matrix
    ? (a, b) => matrix[indexById.get(a)][indexById.get(b)]
    : (a, b) => straightDistance(coordsById.get(a), coordsById.get(b));

  return optimizeOrder(nodeIds, costFn);
}

// Valida lo comun de los calculos de ruta; responde el error y devuelve null si no es valido.
function parseRouteRequest(req, res) {
  const { nodeIds, profile = 'foot' } = req.body || {};

  if (!isValidNodeIdList(nodeIds)) {
    res.status(400).json({ error: NODE_IDS_ERROR });
    return null;
  }
  if (!isValidProfile(profile)) {
    res.status(400).json({ error: 'Modo de transporte inválido' });
    return null;
  }

  const coordsById = findCoordsById(nodeIds);
  if (coordsById.size !== nodeIds.length) {
    res.status(400).json({ error: 'Algún lugar no existe o no tiene coordenadas válidas' });
    return null;
  }

  return { nodeIds, profile, coordsById };
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

// Los usuarios se guardan en minusculas: "Ana" y "ana" son la misma cuenta.
function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

function displayName(row) {
  return [row.names, row.surnames].filter(Boolean).join(' ');
}

// Nueva sesion tras autenticar: evita la fijacion de sesion.
function startSession(req, res, next, user) {
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.user = user;
    res.json({ ok: true, user });
  });
}

router.post('/login', loginLimiter, (req, res, next) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  const normalized = normalizeUsername(username);
  const row = db
    .prepare('SELECT id, names, surnames, role, password_hash, salt FROM users WHERE username = ?')
    .get(normalized);

  if (!row || !row.salt || !verifyPassword(password, row.salt, row.password_hash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  startSession(req, res, next, {
    id: row.id,
    username: normalized,
    nombreCompleto: displayName(row),
    role: row.role,
  });
});

function validateRegistration({ nombre, username, password }) {
  if (typeof nombre !== 'string' || typeof username !== 'string' || typeof password !== 'string') {
    return 'Completa tu nombre, usuario y contraseña';
  }
  const name = nombre.trim();
  if (!name || name.length > MAX_DISPLAY_NAME) {
    return `Escribe tu nombre (máximo ${MAX_DISPLAY_NAME} caracteres)`;
  }
  if (!USERNAME_PATTERN.test(normalizeUsername(username))) {
    return 'El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo';
  }
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`;
  }
  return null;
}

router.post('/register', registerLimiter, (req, res, next) => {
  const body = req.body || {};
  const validationError = validateRegistration(body);
  if (validationError) return res.status(400).json({ error: validationError });

  const username = normalizeUsername(body.username);
  const name = body.nombre.trim();
  const taken = () => res.status(409).json({ error: 'Ese usuario ya existe. Elige otro.' });

  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) return taken();

  const salt = generateSalt();
  let id;
  try {
    ({ lastInsertRowid: id } = db
      .prepare(
        `INSERT INTO users (username, password_hash, salt, names, surnames, role)
         VALUES (?, ?, ?, ?, '', 'user')`
      )
      .run(username, hashPassword(body.password, salt), salt, name));
  } catch (err) {
    // Dos registros simultaneos con el mismo usuario: el UNIQUE de la tabla decide.
    if (String(err.message).includes('UNIQUE')) return taken();
    throw err;
  }

  startSession(req, res, next, { id: Number(id), username, nombreCompleto: name, role: 'user' });
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

// Curaduria editorial: que lugares se recomiendan primero, cuanto toma visitarlos y su foto.
// Las fotos son de Wikimedia Commons; cada una lleva autor, licencia y enlace para atribuirla.
const DESTACADOS = require('../../data/destacados.json');

router.get('/nodes/all', (req, res) => {
  const rows = db.prepare(`${NODE_WITH_CATEGORY_SELECT} ORDER BY nodes.label`).all();
  res.json(
    rows
      .map((row) => ({ ...nodeToCoord(row), destacado: DESTACADOS[row.code] ?? null }))
      .filter((n) => n.lat !== null)
  );
});

// ----- Calculo de rutas por calles -----

// Traza la ruta respetando el orden indicado.
router.post('/route/directions', routingLimiter, async (req, res, next) => {
  try {
    const parsed = parseRouteRequest(req, res);
    if (!parsed) return;
    const { nodeIds, profile, coordsById } = parsed;
    res.json({ order: nodeIds, ...(await buildRoute(nodeIds, coordsById, profile)) });
  } catch (err) {
    next(err);
  }
});

// Busca el orden mas rapido, manteniendo la primera parada como punto de partida.
router.post('/route/compute', routingLimiter, async (req, res, next) => {
  try {
    const parsed = parseRouteRequest(req, res);
    if (!parsed) return;
    const { nodeIds, profile, coordsById } = parsed;
    const order = await computeBestOrder(nodeIds, coordsById, profile);
    res.json({ order, ...(await buildRoute(order, coordsById, profile)) });
  } catch (err) {
    next(err);
  }
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
  // Los tramos estan en orden, asi que al eliminar repetidos queda la secuencia de paradas.
  res.json({ order: nodeIds });
});

router.delete('/routes/:id', requireUser, (req, res) => {
  const routeId = Number(req.params.id);
  const route = Number.isInteger(routeId)
    ? db
        .prepare('SELECT id FROM user_routes WHERE id = ? AND user_id = ?')
        .get(routeId, req.session.user.id)
    : null;
  if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });

  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM user_route_edges WHERE user_route_id = ?').run(routeId);
    db.prepare('DELETE FROM user_routes WHERE id = ?').run(routeId);
    db.exec('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    db.exec('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'No se pudo eliminar la ruta' });
  }
});

router.post('/routes', requireUser, (req, res) => {
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

  const { c: savedCount } = db
    .prepare('SELECT COUNT(*) AS c FROM user_routes WHERE user_id = ?')
    .get(req.session.user.id);
  if (savedCount >= MAX_ROUTES_PER_USER) {
    return res.status(400).json({
      error: `Llegaste al máximo de ${MAX_ROUTES_PER_USER} rutas guardadas. Elimina alguna para guardar otra.`,
    });
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
