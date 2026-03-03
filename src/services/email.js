/**
 * Email service using Resend
 */
const { Resend } = require('resend');
const { config } = require('../config');

const resend = config.resend.apiKey
  ? new Resend(config.resend.apiKey)
  : null;

module.exports = resend;
