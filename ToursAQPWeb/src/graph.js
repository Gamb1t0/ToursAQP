function nearestNeighborOrder(nodeIds, distanceFn) {
  const pending = new Set(nodeIds.slice(1));
  const order = [nodeIds[0]];

  while (pending.size > 0) {
    const actual = order[order.length - 1];
    let mejor = null;
    let mejorDist = Infinity;

    for (const v of pending) {
      const d = distanceFn(actual, v);
      if (d < mejorDist) {
        mejorDist = d;
        mejor = v;
      }
    }

    order.push(mejor);
    pending.delete(mejor);
  }

  return order;
}

// Mejora un recorrido abierto invirtiendo tramos mientras se acorte (2-opt).
// El primer lugar se mantiene fijo: es donde el usuario empieza el tour.
function twoOpt(initialOrder, distanceFn) {
  const order = [...initialOrder];
  const last = order.length - 1;
  const EPSILON = 1e-6;
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 1; i < last; i++) {
      for (let k = i + 1; k <= last; k++) {
        const before =
          distanceFn(order[i - 1], order[i]) + (k < last ? distanceFn(order[k], order[k + 1]) : 0);
        const after =
          distanceFn(order[i - 1], order[k]) + (k < last ? distanceFn(order[i], order[k + 1]) : 0);

        if (after < before - EPSILON) {
          const reversed = order.slice(i, k + 1).reverse();
          order.splice(i, reversed.length, ...reversed);
          improved = true;
        }
      }
    }
  }

  return order;
}

function routeDistance(order, distanceFn) {
  let total = 0;
  for (let i = 0; i < order.length - 1; i++) total += distanceFn(order[i], order[i + 1]);
  return total;
}

function optimizeRoute(nodeIds, distanceFn) {
  if (nodeIds.length === 0) return { order: [], totalDistance: 0 };
  const order = twoOpt(nearestNeighborOrder(nodeIds, distanceFn), distanceFn);
  return { order, totalDistance: routeDistance(order, distanceFn) };
}

module.exports = { nearestNeighborOrder, optimizeRoute, routeDistance };
