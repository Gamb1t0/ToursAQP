function nearestNeighborRoute(nodeIds, distanceFn) {
  if (nodeIds.length === 0) return { order: [], totalDistance: 0 };

  const visited = new Set([nodeIds[0]]);
  const order = [nodeIds[0]];
  let actual = nodeIds[0];
  let totalDistance = 0;

  while (visited.size < nodeIds.length) {
    let mejor = -1;
    let mejorDist = Infinity;

    for (const v of nodeIds) {
      if (visited.has(v)) continue;
      const d = distanceFn(actual, v);
      if (d < mejorDist) {
        mejorDist = d;
        mejor = v;
      }
    }

    if (mejor === -1) break;

    order.push(mejor);
    visited.add(mejor);
    totalDistance += mejorDist;
    actual = mejor;
  }

  return { order, totalDistance };
}

module.exports = { nearestNeighborRoute };
