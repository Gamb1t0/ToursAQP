const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
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
const { clearRoutingCache } = require('../src/routing');

const UNREACHABLE_URL = 'http://127.0.0.1:1';

let server;
let base;
let fakeOsrm;
let fakeOsrmUrl;
const originalConsoleError = console.error;

// Servidor OSRM falso: las pruebas no dependen de internet ni del servicio publico.
// Con n puntos, la matriz solo hace barato el recorrido 0 -> n-1 -> n-2 -> ... -> 1.
function handleFakeOsrm(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost');
  const [, service] = pathname.match(/\/(route|table)\/v1\//);
  const coords = pathname.split('/').pop().split(';').map((pair) => pair.split(',').map(Number));
  const n = coords.length;

  const body =
    service === 'table'
      ? {
          code: 'Ok',
          durations: coords.map((_, i) =>
            coords.map((__, j) => {
              if (i === j) return 0;
              return j === (i === 0 ? n - 1 : i - 1) ? 1 : 100;
            })
          ),
        }
      : {
          code: 'Ok',
          routes: [
            {
              distance: 1000 * (n - 1),
              duration: 600 * (n - 1),
              geometry: { coordinates: [...coords, [-71.5, -16.4]] },
              legs: coords.slice(1).map(() => ({ distance: 1000, duration: 600 })),
            },
          ],
        };

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function useRoutingService(url) {
  process.env.ROUTING_FOOT_URL = url;
  process.env.ROUTING_CAR_URL = url;
  clearRoutingCache();
}

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

  fakeOsrm = http.createServer(handleFakeOsrm).listen(0);
  await new Promise((resolve) => fakeOsrm.once('listening', resolve));
  fakeOsrmUrl = `http://127.0.0.1:${fakeOsrm.address().port}`;

  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  useRoutingService(fakeOsrmUrl);
  console.error = originalConsoleError;
});

after(() => {
  server.close();
  server.closeAllConnections();
  fakeOsrm.close();
  fakeOsrm.closeAllConnections();
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('directions sigue las calles y respeta el orden indicado', async () => {
  const res = await request('POST', '/api/route/directions', { body: { nodeIds: [3, 1, 2] } });
  const route = await res.json();

  assert.equal(res.status, 200);
  assert.equal(route.routed, true);
  assert.deepEqual(route.order, [3, 1, 2]);
  assert.equal(route.distance, 2000);
  assert.equal(route.duration, 1200);
  assert.equal(route.legs.length, 2);
  // La geometria llega como [lat, lon], el formato que usa Leaflet.
  assert.deepEqual(route.geometry.at(-1), [-16.4, -71.5]);
});

test('compute ordena segun los tiempos por calles', async () => {
  const res = await request('POST', '/api/route/compute', {
    body: { nodeIds: [1, 2, 3, 4], profile: 'car' },
  });
  const route = await res.json();

  assert.equal(res.status, 200);
  assert.deepEqual(route.order, [1, 4, 3, 2]);
  assert.equal(route.routed, true);
});

test('si el servicio de rutas falla, avisa y usa la linea recta', async () => {
  useRoutingService(UNREACHABLE_URL);
  console.error = () => {};

  for (const endpoint of ['directions', 'compute']) {
    const res = await request('POST', `/api/route/${endpoint}`, { body: { nodeIds: [1, 2, 3] } });
    const route = await res.json();

    assert.equal(res.status, 200);
    assert.equal(route.routed, false);
    assert.equal(route.geometry.length, 3);
    assert.ok(route.distance > 0);
    assert.equal(route.legs.length, 2);
  }
});

test('el calculo de rutas rechaza entradas invalidas con 400', async () => {
  const invalid = [
    { nodeIds: [1] },
    { nodeIds: [1, 1] },
    { nodeIds: [{ a: 1 }, 2] },
    { nodeIds: ['1', '2'] },
    { nodeIds: [1, 99999] },
    { nodeIds: 'x' },
    { nodeIds: [1, 2], profile: 'avion' },
    { nodeIds: [1, 2], profile: '__proto__' },
    { nodeIds: Array.from({ length: 26 }, (_, i) => i + 1) },
  ];

  for (const body of invalid) {
    for (const endpoint of ['directions', 'compute']) {
      const res = await request('POST', `/api/route/${endpoint}`, { body });
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.ok((await res.json()).error);
    }
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

test('una ruta guardada solo la ve y la elimina su dueno, y conserva el orden', async () => {
  const admin = await login('admin', 'admin123');

  const created = await request('POST', '/api/routes', {
    cookie: admin,
    body: { name: 'Mi ruta', nodeIds: [3, 1, 2] },
  });
  assert.equal(created.status, 200);
  const { id } = await created.json();

  const own = await request('GET', `/api/routes/${id}`, { cookie: admin });
  assert.equal(own.status, 200);
  assert.deepEqual((await own.json()).order, [3, 1, 2]);

  assert.equal((await request('GET', `/api/routes/${id}`)).status, 401);
  assert.equal((await request('DELETE', `/api/routes/${id}`)).status, 401);

  const other = await login('turista', 'clave123');
  assert.equal((await request('GET', `/api/routes/${id}`, { cookie: other })).status, 404);
  assert.equal((await request('GET', '/api/routes/abc', { cookie: other })).status, 404);
  assert.equal((await request('DELETE', `/api/routes/${id}`, { cookie: other })).status, 404);

  assert.equal((await request('DELETE', `/api/routes/${id}`, { cookie: admin })).status, 200);
  assert.equal((await request('GET', `/api/routes/${id}`, { cookie: admin })).status, 404);
  const edges = db.prepare('SELECT COUNT(*) AS c FROM user_route_edges WHERE user_route_id = ?').get(id);
  assert.equal(edges.c, 0);
});

test('guardar rutas exige sesion; administrar lugares exige rol admin', async () => {
  const other = await login('turista', 'clave123');
  const body = { name: 'Ruta del turista', nodeIds: [1, 2] };

  assert.equal((await request('POST', '/api/routes', { body })).status, 401);
  assert.equal((await request('POST', '/api/routes', { body, cookie: other })).status, 200);
  assert.equal((await request('GET', '/api/admin/nodes', { cookie: other })).status, 403);
  assert.equal((await request('PUT', '/api/admin/nodes/1', { body: {}, cookie: other })).status, 403);
});

async function register(body) {
  return request('POST', '/api/register', { body });
}

test('crear una cuenta inicia sesion y permite guardar rutas propias', async () => {
  const res = await register({ nombre: '  Lucía Pérez ', username: 'Lucia.Perez', password: 'arequipa123' });
  assert.equal(res.status, 200);
  const { user } = await res.json();
  assert.deepEqual(user, { id: user.id, username: 'lucia.perez', nombreCompleto: 'Lucía Pérez', role: 'user' });

  const cookie = res.headers.get('set-cookie').split(';')[0];
  const session = await (await request('GET', '/api/session', { cookie })).json();
  assert.equal(session.user.username, 'lucia.perez');

  const saved = await request('POST', '/api/routes', { cookie, body: { name: 'Centro', nodeIds: [1, 2, 3] } });
  assert.equal(saved.status, 200);
  const routes = await (await request('GET', '/api/routes', { cookie })).json();
  assert.deepEqual(routes.map((r) => r.name), ['Centro']);

  // La contrasena queda hasheada, nunca en texto plano.
  const row = db.prepare('SELECT password_hash, salt FROM users WHERE username = ?').get('lucia.perez');
  assert.notEqual(row.password_hash, 'arequipa123');
  assert.ok(row.salt);

  // Se puede entrar despues, sin importar mayusculas en el usuario.
  await login('LUCIA.PEREZ', 'arequipa123');
});

test('el registro rechaza usuarios repetidos y datos invalidos', async () => {
  const valid = { nombre: 'Mateo', username: 'mateo', password: 'arequipa123' };
  assert.equal((await register(valid)).status, 200);

  const duplicate = await register({ ...valid, username: 'MATEO' });
  assert.equal(duplicate.status, 409);
  assert.match((await duplicate.json()).error, /ya existe/);

  const invalid = [
    { ...valid, username: 'ab' },
    { ...valid, username: 'con espacio' },
    { ...valid, username: 'x'.repeat(31) },
    { ...valid, username: 'mateo2', password: 'corta' },
    { ...valid, username: 'mateo3', nombre: '   ' },
    { ...valid, username: 'mateo4', nombre: 'n'.repeat(61) },
    { ...valid, username: { a: 1 } },
    { username: 'mateo5', password: 'arequipa123' },
  ];
  for (const body of invalid) {
    const res = await register(body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.ok((await res.json()).error);
  }
});

test('nadie puede crear una cuenta de administrador desde el registro', async () => {
  const res = await register({ nombre: 'Intruso', username: 'intruso', password: 'arequipa123', role: 'admin' });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).user.role, 'user');
  assert.equal(db.prepare('SELECT role FROM users WHERE username = ?').get('intruso').role, 'user');
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

// Debe ir despues de las otras pruebas de registro: agota el cupo de cuentas de esta IP.
test('el registro se limita a 10 cuentas por hora por conexion', async () => {
  const statuses = [];
  for (let i = 0; i < 12; i++) {
    const res = await register({ nombre: 'Masivo', username: `masivo${i}`, password: 'arequipa123' });
    statuses.push(res.status);
  }
  // Las pruebas anteriores ya crearon 3 cuentas: quedan 7 antes del bloqueo.
  assert.deepEqual(statuses.slice(0, 7), Array(7).fill(200));
  assert.ok(statuses.slice(7).every((status) => status === 429), JSON.stringify(statuses));
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
