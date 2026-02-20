const { requireAdmin } = require('./_lib/admin-token');
const { supabase, hasSupabase } = require('./_lib/supabase');

exports.handler = async function(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (event.httpMethod !== 'DELETE') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: 'Storage not configured' };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid payload' };
  }

  const { emailId } = payload;
  
  if (!emailId) {
    return { statusCode: 400, body: 'Email ID required' };
  }

  try {
    const { error } = await supabase
      .from('emails')
      .delete()
      .eq('id', emailId);

    if (error) {
      console.log('delete error', error.message);
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.log('delete handler error', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
