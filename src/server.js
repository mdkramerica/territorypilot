/**
 * TerritoryPilot — Server entry point
 */
const { config, validateConfig } = require('./config');
const app = require('./app');

validateConfig();

// ─── Morning Brief Cron (6 AM daily) ────────────────────────────────────────
if (process.env.CRON_ENABLED === 'true') {
  const cron = require('node-cron');
  const { sendMorningBriefs } = require('./services/morningBrief');

  cron.schedule('0 6 * * *', sendMorningBriefs, {
    timezone: 'America/Chicago',
  });
  console.log('Morning brief cron scheduled: 6 AM CT daily');
}

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`TerritoryPilot API running on :${PORT}`);
});
