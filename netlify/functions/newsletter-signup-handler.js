const { supabase, hasSupabase } = require('./_lib/supabase');

exports.handler = async function(event) {
  console.log('[newsletter-signup-handler] START', { method: event.httpMethod });
  
  // CORS headers
  const responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: responseHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: responseHeaders, body: JSON.stringify({ ok: false, error: 'method_not_allowed' }) };
  }

  // Parse JSON
  let email = '';
  try {
    const body = JSON.parse(event.body || '{}');
    email = (body.email || '').trim().toLowerCase();
  } catch (e) {
    console.error('JSON parse error:', e);
    return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ ok: false, error: 'parse_error' }) };
  }

  // Validate email
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.log('Invalid email:', email);
    return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ ok: false, error: 'invalid_email' }) };
  }

  // Check Supabase
  if (!hasSupabase || !supabase) {
    console.error('No Supabase');
    return { statusCode: 500, headers: responseHeaders, body: JSON.stringify({ ok: false, error: 'no_db' }) };
  }

  try {
    // Insert
    console.log('Inserting:', email);
    const { data, error } = await supabase.from('newsletter_subscribers').insert({ email, status: 'active' }).select();
    
    if (error) {
      console.error('Insert error:', error);
      // Check if duplicate
      if (error.code === '23505') {
        return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ ok: true, message: 'already_subscribed', email }) };
      }
      return { statusCode: 500, headers: responseHeaders, body: JSON.stringify({ ok: false, error: error.message }) };
    }

    console.log('Success, inserted:', data?.length);
    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ ok: true, message: 'subscribed', email, count: data?.length || 1 }) };
  } catch (err) {
    console.error('Exception:', err.message);
    return { statusCode: 500, headers: responseHeaders, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
