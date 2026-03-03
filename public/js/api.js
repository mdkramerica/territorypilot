/**
 * API helper — auth headers, fetch wrapper, token management, utilities
 */

const API = window.location.origin;

// ─── Token Management ────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
}

function setAuth(session, user) {
  localStorage.setItem('token', session.access_token);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function requireAuth() {
  const token = getToken();
  const user = getUser();
  if (!token || !user) {
    window.location.href = 'login.html';
    return null;
  }
  return { token, user };
}

// ─── API Fetch Wrapper ───────────────────────────────────────────────────────

function authHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
  };
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { ...authHeaders(), ...(opts.headers || {}) },
  });

  if (res.status === 401) {
    clearAuth();
    window.location.href = 'login.html';
    return null;
  }

  return res;
}

// ─── UI Utilities ────────────────────────────────────────────────────────────

function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => {
    t.style.display = 'none';
  }, 2500);
}

function formatDate(d) {
  if (!d) return 'Never';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function priorityBadge(p) {
  const map = {
    1: ['High', 'badge-high'],
    2: ['Med', 'badge-med'],
    3: ['Low', 'badge-low'],
  };
  const [label, cls] = map[p] || map[2];
  return `<span class="badge-priority ${cls}">${label}</span>`;
}

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Escape for use inside HTML attribute values (single-quote safe)
function escAttr(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Offline Detection ───────────────────────────────────────────────────────

function initOfflineDetection() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;

  function update() {
    banner.classList.toggle('show', !navigator.onLine);
  }

  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}
