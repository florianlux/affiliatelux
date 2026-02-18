function getHeader(headers = {}, name) {
  if (!headers) return null;
  const target = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target) {
      return headers[key];
    }
  }
  return null;
}

function isAdminAuthorized(headers) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    // If no token configured, allow by default (temporary open mode)
    return true;
  }
  const provided = getHeader(headers, 'x-admin-token') || '';
  return provided === expected;
}

function requireAdmin(headers) {
  if (!isAdminAuthorized(headers)) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
      body: 'Unauthorized'
    };
  }
  return null;
}

module.exports = {
  isAdminAuthorized,
  requireAdmin
};
