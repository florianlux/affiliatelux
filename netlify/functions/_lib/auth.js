const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { supabase, hasSupabase } = require('./supabase');

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

function ensureSupabase(feature) {
  if (!hasSupabase || !supabase) {
    throw new Error(`Supabase not configured (${feature})`);
  }
}

async function verifyPassword(plain) {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) throw new Error('ADMIN_PASSWORD_HASH not configured');
  return bcrypt.compare(plain, hash);
}

async function isRateLimited(ip) {
  if (!ip) return false;
  if (!hasSupabase || !supabase) return false;
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from('admin_login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', cutoff);
  if (error) {
    console.log('rate limit check failed', error.message);
    return false;
  }
  return (count || 0) >= RATE_LIMIT_MAX_ATTEMPTS;
}

async function recordFailedAttempt(ip) {
  if (!ip) return;
  if (!hasSupabase || !supabase) return;
  const { error } = await supabase
    .from('admin_login_attempts')
    .insert({ ip });
  if (error) {
    console.log('record attempt failed', error.message);
  }
  await logAudit('failed_login', { ip });
}

async function clearAttempts(ip) {
  if (!ip) return;
  if (!hasSupabase || !supabase) return;
  await supabase
    .from('admin_login_attempts')
    .delete()
    .eq('ip', ip);
}

async function logAudit(event, payload = {}) {
  if (!hasSupabase || !supabase) return;
  const entry = {
    event,
    payload,
    created_at: new Date().toISOString()
  };
  const { error } = await supabase
    .from('admin_audit_log')
    .insert(entry);
  if (error) {
    console.log('audit log failed', error.message);
  }
}

async function createSession(ip) {
  ensureSupabase('session storage');
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
  const record = {
    token,
    ip: ip || null,
    created_at: new Date(now).toISOString(),
    expires_at: expiresAt
  };
  const { error } = await supabase
    .from('admin_sessions')
    .insert(record);
  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }
  await supabase
    .from('admin_sessions')
    .delete()
    .lte('expires_at', new Date(Date.now() - SESSION_TTL_MS).toISOString());
  return token;
}

async function verifySession(token) {
  if (!token) return false;
  if (!hasSupabase || !supabase) return false;
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('admin_sessions')
    .select('token')
    .eq('token', token)
    .gt('expires_at', nowIso)
    .maybeSingle();
  if (error) {
    console.log('session verify failed', error.message);
    return false;
  }
  return Boolean(data);
}

async function destroySession(token) {
  if (!token) return;
  if (!hasSupabase || !supabase) return;
  await supabase
    .from('admin_sessions')
    .delete()
    .eq('token', token);
}

function getCookie(headers = {}, name) {
  const header = headers.cookie || headers.Cookie || '';
  const cookies = header.split(';').map(chunk => chunk.trim()).filter(Boolean);
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split('=');
    if (key === name) {
      return rest.join('=');
    }
  }
  return null;
}

function buildSessionCookie(value) {
  const secure = process.env.CONTEXT && process.env.CONTEXT !== 'dev';
  const parts = [
    `dc_admin_session=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=86400'
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function clearSessionCookie() {
  return 'dc_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

module.exports = {
  verifyPassword,
  isRateLimited,
  recordFailedAttempt,
  clearAttempts,
  createSession,
  verifySession,
  destroySession,
  logAudit,
  getCookie,
  buildSessionCookie,
  clearSessionCookie
};
