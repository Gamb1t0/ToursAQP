const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseUbication } = require('../src/geo');
const { nearestNeighborOrder, optimizeOrder, routeCost } = require('../src/graph');

// Puntos sobre una recta: el costo es la diferencia de posiciones.
const lineCost = (positions) => (a, b) => Math.abs(positions[a] - positions[b]);

test('optimizeOrder conserva el primer lugar y visita todos una sola vez', () => {
  const cost = lineCost({ 1: 5, 2: 0, 3: 9, 4: 2, 5: 7 });
  const order = optimizeOrder([1, 2, 3, 4, 5], cost);

  assert.equal(order[0], 1);
  assert.deepEqual([...order].sort(), [1, 2, 3, 4, 5]);
});

test('optimizeOrder mejora un recorrido donde el vecino mas cercano se equivoca', () => {
  // Vecino mas cercano: 0 -> 2 -> -3 -> 10 = 20. Lo mejor es ir primero a -3: 0 -> -3 -> 2 -> 10 = 16.
  const cost = lineCost({ 1: 0, 2: 2, 3: -3, 4: 10 });
  const ids = [1, 2, 3, 4];

  assert.equal(routeCost(nearestNeighborOrder(ids, cost), cost), 20);
  assert.deepEqual(optimizeOrder(ids, cost), [1, 3, 2, 4]);
});

test('optimizeOrder encuentra el recorrido optimo en un caso pequeno', () => {
  // Cuadrado de lado 1: lo optimo es recorrer el perimetro (3), sin cruzar la diagonal.
  const pts = { 1: [0, 0], 2: [1, 1], 3: [0, 1], 4: [1, 0] };
  const cost = (a, b) => Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]);

  assert.ok(Math.abs(routeCost(optimizeOrder([1, 2, 3, 4], cost), cost) - 3) < 1e-9);
});

test('optimizeOrder tiene en cuenta los sentidos unicos', () => {
  // Solo es barato avanzar en el sentido 1 -> 4 -> 3 -> 2; al reves cuesta mucho.
  const cheap = new Set(['1-4', '4-3', '3-2']);
  const cost = (a, b) => (cheap.has(`${a}-${b}`) ? 1 : 100);

  assert.deepEqual(optimizeOrder([1, 2, 3, 4], cost), [1, 4, 3, 2]);
});

test('optimizeOrder admite listas vacias y de un solo lugar', () => {
  assert.deepEqual(optimizeOrder([], () => 0), []);
  assert.deepEqual(optimizeOrder([7], () => 0), [7]);
});

test('parseUbication rechaza coordenadas invalidas', () => {
  assert.deepEqual(parseUbication('-16.39, -71.53'), { lat: -16.39, lon: -71.53 });
  for (const bad of ['', ',', '1,', 'abc,def', '1,2,3', '91,0', '0,181', null]) {
    assert.equal(parseUbication(bad), null, `deberia rechazar: ${bad}`);
  }
});
