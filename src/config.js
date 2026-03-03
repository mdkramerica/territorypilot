/**
 * Environment configuration with validation
 */
require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  appUrl: process.env.APP_URL || 'http://localhost:3000',

  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },

  google: {
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    prices: {
      solo: process.env.STRIPE_PRICE_SOLO || '',
      team: process.env.STRIPE_PRICE_TEAM || '',
      agency: process.env.STRIPE_PRICE_AGENCY || '',
    },
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
  },
};

function validateConfig() {
  const warnings = [];
  const required = [
    ['SUPABASE_URL', config.supabase.url],
    ['SUPABASE_SERVICE_KEY', config.supabase.serviceKey],
    ['OPENAI_API_KEY', config.openai.apiKey],
  ];

  for (const [name, value] of required) {
    if (!value || value === 'placeholder') {
      warnings.push(name);
    }
  }

  if (warnings.length > 0) {
    console.warn(`WARNING: Missing or placeholder env vars: ${warnings.join(', ')}`);
    console.warn('Some features will be unavailable.');
  }

  if (config.supabase.url && !config.supabase.url.startsWith('http')) {
    console.warn('WARNING: SUPABASE_URL does not look like a valid URL');
  }
}

module.exports = { config, validateConfig };
