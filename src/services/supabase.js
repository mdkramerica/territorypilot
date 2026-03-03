/**
 * Shared Supabase client — single instance used across all modules
 */
const { createClient } = require('@supabase/supabase-js');
const { config } = require('../config');

let supabase = null;

if (config.supabase.url.startsWith('http') && config.supabase.serviceKey) {
  supabase = createClient(config.supabase.url, config.supabase.serviceKey);
}

module.exports = supabase;
