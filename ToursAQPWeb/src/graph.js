function nearestNeighborOrder(nodeIds, costFn) {
  const pending = new Set(nodeIds.slice(1));
  const order = [nodeIds[0]];

  while (pending.size > 0) {
    const actual = order[order.length - 1];
    let mejor = null;
    let mejorCosto = Infinity;

    for (const v of pending) {
      const c = costFn(actual, v);
      if (c < mejorCosto) {
        mejorCosto = c;
        mejor = v;
      }
    }

    order.push(mejor);
    pending.delete(mejor);
  }

  return order;
}

function routeCost(order, costFn) {
  let total = 0;
  for (let i = 0; i < order.length - 1; i++) total += costFn(order[i], order[i + 1]);
  return total;
}

// Mejora un recorrido abierto invirtiendo tramos mientras se acorte (2-opt).
// El primer lugar se mantiene fijo: es donde el usuario empieza el tour.
// Recalcula el costo completo porque por calles ir de A a B puede costar distinto
// que de B a A (sentidos unicos), asi que invertir un tramo cambia todo su interior.
function twoOpt(initialOrder, costFn) {
  let order = [...initialOrder];
  let bestCost = routeCost(order, costFn);
  const EPSILON = 1e-6;
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 1; i < order.length - 1; i++) {
      for (let k = i + 1; k < order.length; k++) {
        const candidate = [
          ...order.slice(0, i),
          ...order.slice(i, k + 1).reverse(),
          ...order.slice(k + 1),
        ];
        const cost = routeCost(candidate, costFn);
        if (cost < bestCost - EPSILON) {
          order = candidate;
          bestCost = cost;
          improved = true;
        }
      }
    }
  }

  return order;
}

function optimizeOrder(nodeIds, costFn) {
  if (nodeIds.length === 0) return [];
  return twoOpt(nearestNeighborOrder(nodeIds, costFn), costFn);
}

module.exports = { nearestNeighborOrder, optimizeOrder, routeCost };
