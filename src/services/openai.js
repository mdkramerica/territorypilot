/**
 * Shared OpenAI client
 */
const OpenAI = require('openai');
const { config } = require('../config');

const openai = config.openai.apiKey
  ? new OpenAI({ apiKey: config.openai.apiKey })
  : null;

module.exports = openai;
