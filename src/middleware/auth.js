/**
 * JWT authentication middleware
 * Validates Bearer token via Supabase and attaches user to req
 */
const supabase = require('../services/supabase');

async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = header.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Auth service unavailable' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

module.exports = auth;
