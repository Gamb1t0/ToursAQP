// Cliente de OSRM para calcular rutas por calles reales.
// Por defecto usa los servidores publicos de FOSSGIS sobre datos de OpenStreetMap.
// Son gratuitos y de uso limitado: si la app crece, hay que hospedar un OSRM propio
// y apuntar estas variables de entorno hacia el.
const DEFAULT_URLS = {
  foot: 'https://routing.openstreetmap.de/routed-foot',
  car: 'https://routing.openstreetmap.de/routed-car',
};

const REQUEST_TIMEOUT_MS = 8000;
const CACHE_LIMIT = 500;

const cache = new Map();

function baseUrl(profile) {
  const override = profile === 'foot' ? process.env.ROUTING_FOOT_URL : process.env.ROUTING_CAR_URL;
  return override || DEFAULT_URLS[profile];
}

function isValidProfile(profile) {
  return Object.hasOwn(DEFAULT_URLS, profile);
}

async function osrmRequest(profile, service, coords, query) {
  const path = coords.map((c) => `${c.lon},${c.lat}`).join(';');
  const url = `${baseUrl(profile)}/${service}/v1/driving/${path}?${query}`;

  if (cache.has(url)) return cache.get(url);

  const response = await fetch(url, {
    headers: { 'User-Agent': 'ToursAQP/1.0' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`OSRM respondio ${response.status}`);

  const data = await response.json();
  if (data.code !== 'Ok') throw new Error(`OSRM respondio ${data.code}`);

  // Las rutas casi no cambian: el cache evita repetir consultas al servicio publico.
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(url, data);
  return data;
}

// Matriz de duraciones (segundos) entre todos los puntos, o null si hay tramos sin conexion.
async function getDurationMatrix(coords, profile) {
  const data = await osrmRequest(profile, 'table', coords, 'annotations=duration');
  const hasGaps = data.durations.some((row) => row.some((value) => value === null));
  return hasGaps ? null : data.durations;
}

async function getDirections(coords, profile) {
  const data = await osrmRequest(profile, 'route', coords, 'overview=full&geometries=geojson&steps=false');
  const route = data.routes[0];

  return {
    distance: route.distance,
    duration: route.duration,
    geometry: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    legs: route.legs.map((leg) => ({ distance: leg.distance, duration: leg.duration })),
  };
}

function clearRoutingCache() {
  cache.clear();
}

module.exports = { isValidProfile, getDurationMatrix, getDirections, clearRoutingCache };
