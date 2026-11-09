const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseUbication } = require('../src/geo');
const { nearestNeighborOrder, optimizeRoute, routeDistance } = require('../src/graph');

// Puntos sobre una recta: la distancia es la diferencia de posiciones.
const lineDistance = (positions) => (a, b) => Math.abs(positions[a] - positions[b]);

test('optimizeRoute conserva el primer lugar y visita todos una sola vez', () => {
  const dist = lineDistance({ 1: 5, 2: 0, 3: 9, 4: 2, 5: 7 });
  const { order } = optimizeRoute([1, 2, 3, 4, 5], dist);

  assert.equal(order[0], 1);
  assert.deepEqual([...order].sort(), [1, 2, 3, 4, 5]);
});

test('optimizeRoute acorta un recorrido donde el vecino mas cercano se equivoca', () => {
  // Vecino mas cercano: 0 -> 2 -> -3 -> 10 = 20. Lo mejor es ir primero a -3: 0 -> -3 -> 2 -> 10 = 16.
  const dist = lineDistance({ 1: 0, 2: 2, 3: -3, 4: 10 });
  const ids = [1, 2, 3, 4];

  assert.equal(routeDistance(nearestNeighborOrder(ids, dist), dist), 20);
  assert.deepEqual(optimizeRoute(ids, dist), { order: [1, 3, 2, 4], totalDistance: 16 });
});

test('optimizeRoute encuentra el recorrido optimo en un caso pequeno', () => {
  // Cuadrado de lado 1: lo optimo es recorrer el perimetro (3), sin cruzar la diagonal.
  const pts = { 1: [0, 0], 2: [1, 1], 3: [0, 1], 4: [1, 0] };
  const dist = (a, b) => Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]);

  assert.ok(Math.abs(optimizeRoute([1, 2, 3, 4], dist).totalDistance - 3) < 1e-9);
});

test('optimizeRoute admite listas vacias y de un solo lugar', () => {
  assert.deepEqual(optimizeRoute([], () => 0), { order: [], totalDistance: 0 });
  assert.deepEqual(optimizeRoute([7], () => 0), { order: [7], totalDistance: 0 });
});

test('parseUbication rechaza coordenadas invalidas', () => {
  assert.deepEqual(parseUbication('-16.39, -71.53'), { lat: -16.39, lon: -71.53 });
  for (const bad of ['', ',', '1,', 'abc,def', '1,2,3', '91,0', '0,181', null]) {
    assert.equal(parseUbication(bad), null, `deberia rechazar: ${bad}`);
  }
});
