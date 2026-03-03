/**
 * RouteIQ — Server entry point
 */
const { config, validateConfig } = require('./config');
const app = require('./app');

validateConfig();

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`RouteIQ API running on :${PORT}`);
});
