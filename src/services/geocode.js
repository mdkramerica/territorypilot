/**
 * Google Maps geocoding service with concurrency control
 */
const axios = require('axios');
const { config } = require('../config');

const CONCURRENCY_LIMIT = 10;

async function geocodeAddress(address) {
  if (!address || !config.google.mapsApiKey) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${config.google.mapsApiKey}`;
    const { data } = await axios.get(url);
    const loc = data.results?.[0]?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch {
    return null;
  }
}

async function geocodeBatch(items, addressFn) {
  const results = [];
  for (let i = 0; i < items.length; i += CONCURRENCY_LIMIT) {
    const batch = items.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const address = addressFn(item);
        const coords = await geocodeAddress(address);
        return { ...item, lat: coords?.lat || null, lng: coords?.lng || null };
      })
    );
    results.push(...batchResults);
  }
  return results;
}

module.exports = { geocodeAddress, geocodeBatch };
