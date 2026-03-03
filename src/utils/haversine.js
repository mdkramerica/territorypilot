/**
 * Haversine distance formula + nearest-neighbor TSP solver
 */

const toRad = (d) => (d * Math.PI) / 180;

function haversine(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestNeighborTSP(accounts, startLat, startLng) {
  let unvisited = accounts.filter((a) => a.lat && a.lng);
  const route = [];
  let curLat = startLat;
  let curLng = startLng;

  while (unvisited.length > 0) {
    let nearest = unvisited.reduce((best, acct) => {
      const d = haversine(curLat, curLng, acct.lat, acct.lng);
      return !best || d < best.dist ? { acct, dist: d } : best;
    }, null);

    route.push({ ...nearest.acct, distFromPrev: nearest.dist.toFixed(1) });
    curLat = nearest.acct.lat;
    curLng = nearest.acct.lng;
    unvisited = unvisited.filter((a) => a.id !== nearest.acct.id);
  }

  const totalMiles = route.reduce(
    (sum, a) => sum + parseFloat(a.distFromPrev || 0),
    0
  );

  return { route, totalMiles: parseFloat(totalMiles.toFixed(1)) };
}

module.exports = { haversine, nearestNeighborTSP };
