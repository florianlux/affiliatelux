const { getCookie, verifySession } = require('./_lib/auth');

function redirect(to) {
  return {
    statusCode: 302,
    headers: {
      Location: to,
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    },
    body: ''
  };
}

exports.handler = async function(event) {
  const subPath = event.path.replace(/^\/admin/, '') || '/';

  if (subPath.startsWith('/login')) {
    return redirect('/admin-login.html');
  }

  const token = getCookie(event.headers || {}, 'dc_admin_session');
  const allowed = await verifySession(token);
  if (!allowed) {
    return redirect('/admin-login.html');
  }

  return redirect('/admin.html');
};