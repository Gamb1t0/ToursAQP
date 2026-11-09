const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Las pruebas trabajan sobre una copia: la base de datos del repositorio no se toca.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toursaqp-test-'));
const tmpDb = path.join(tmpDir, 'Tours.s3db');
fs.copyFileSync(path.join(__dirname, '..', 'data', 'Tours.s3db'), tmpDb);
process.env.TOURS_DB_PATH = tmpDb;

const db = require('../src/db');
const { createApp } = require('../src/app');
const { generateSalt, hashPassword } = require('../src/auth');

let server;
let base;

function request(method, url, { body, cookie } = {}) {
  return fetch(base + url, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
}

async function login(username, password) {
  const res = await request('POST', '/api/login', { body: { username, password } });
  assert.equal(res.status, 200);
  return res.headers.get('set-cookie').split(';')[0];
}

before(async () => {
  const salt = generateSalt();
  db.prepare(
    `INSERT INTO users (username, password_hash, salt, names, surnames, role)
     VALUES ('turista', ?, ?, 'Test', 'Turista', 'user')`
  ).run(hashPassword('clave123', salt), salt);

  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  server.closeAllConnections();
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('la busqueda ignora acentos y mayusculas', async () => {
  const labels = async (q) =>
    (await (await request('GET', `/api/search?q=${q}`)).json()).map((n) => n.label);

  assert.ok((await labels('volcan')).includes('Volcán Misti'));
  assert.ok((await labels('CANON')).includes('Cañón del Colca'));
  assert.ok((await labels('Volc%C3%A1n')).includes('Volcán Misti'));
});

test('compute devuelve todos los lugares y empieza en el primero', async () => {
  const res = await request('POST', '/api/route/compute', { body: { nodeIds: [1, 2, 3, 4] } });
  const { order, totalDistance } = await res.json();

  assert.equal(res.status, 200);
  assert.equal(order[0], 1);
  assert.deepEqual([...order].sort(), [1, 2, 3, 4]);
  assert.ok(totalDistance > 0);
});

test('compute rechaza entradas invalidas con 400', async () => {
  for (const nodeIds of [[1], [1, 1], [{ a: 1 }, 2], ['1', '2'], [1, 99999], 'x']) {
    const res = await request('POST', '/api/route/compute', { body: { nodeIds } });
    assert.equal(res.status, 400, JSON.stringify(nodeIds));
    assert.ok((await res.json()).error);
  }
});

test('los errores son JSON y no exponen trazas', async () => {
  const res = await request('POST', '/api/login', { body: '{malo' });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'JSON invalido' });

  const missing = await request('GET', '/api/no-existe');
  assert.equal(missing.status, 404);
  assert.ok((await missing.json()).error);
});

test('una ruta guardada solo la ve su dueno y conserva el orden', async () => {
  const admin = await login('admin', 'admin123');
  const nodeIds = [3, 1, 2];

  const created = await request('POST', '/api/routes', {
    cookie: admin,
    body: { name: 'Mi ruta', nodeIds },
  });
  assert.equal(created.status, 200);
  const { id } = await created.json();

  const own = await request('GET', `/api/routes/${id}`, { cookie: admin });
  assert.equal(own.status, 200);
  assert.deepEqual((await own.json()).edges, [{ from: 3, to: 1 }, { from: 1, to: 2 }]);

  assert.equal((await request('GET', `/api/routes/${id}`)).status, 401);

  const other = await login('turista', 'clave123');
  assert.equal((await request('GET', `/api/routes/${id}`, { cookie: other })).status, 404);
  assert.equal((await request('GET', '/api/routes/abc', { cookie: other })).status, 404);
});

test('guardar rutas y administrar lugares exige rol admin', async () => {
  const other = await login('turista', 'clave123');
  const body = { name: 'x', nodeIds: [1, 2] };

  assert.equal((await request('POST', '/api/routes', { body })).status, 403);
  assert.equal((await request('POST', '/api/routes', { body, cookie: other })).status, 403);
  assert.equal((await request('GET', '/api/admin/nodes', { cookie: other })).status, 403);
});

test('editar un lugar valida los datos', async () => {
  const admin = await login('admin', 'admin123');
  const valid = { code: 'PLAZA', label: 'Plaza de Armas', desc: 'd', ubication: '-16.39,-71.53', type_id: 1 };
  const put = (id, body) => request('PUT', `/api/admin/nodes/${id}`, { cookie: admin, body });

  assert.equal((await put(1, valid)).status, 200);
  assert.equal((await put(999999, { ...valid, code: 'NUEVO' })).status, 404);
  assert.equal((await put(2, valid)).status, 409);
  assert.equal((await put(1, { label: 'solo nombre' })).status, 400);
  assert.equal((await put(1, { ...valid, ubication: 'no-es-coord' })).status, 400);
  assert.equal((await put(1, { ...valid, ubication: ',' })).status, 400);
  assert.equal((await put(1, { ...valid, type_id: 999 })).status, 400);
});

test('logout invalida la sesion', async () => {
  const admin = await login('admin', 'admin123');
  await request('POST', '/api/logout', { cookie: admin });

  const res = await request('GET', '/api/session', { cookie: admin });
  assert.equal((await res.json()).user, null);
});

test('login con tipos invalidos responde 400', async () => {
  const res = await request('POST', '/api/login', { body: { username: { a: 1 }, password: 'x' } });
  assert.equal(res.status, 400);
});

// Debe ir al final: agota el limite de intentos de esta IP.
test('login se bloquea tras demasiados intentos fallidos', async () => {
  const statuses = [];
  for (let i = 0; i < 12; i++) {
    const res = await request('POST', '/api/login', { body: { username: 'admin', password: 'mala' } });
    statuses.push(res.status);
  }
  assert.equal(statuses[0], 401);
  assert.equal(statuses.at(-1), 429);
});
