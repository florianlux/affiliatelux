const { supabase, hasSupabase } = require('./_lib/supabase');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

exports.handler = async function(event) {
  SYNTAX_ERROR_12345_HERE  // This will crash
  console.log('[subscribe] Processing request:', { method: event.httpMethod, hasBody: !!event.body });
  
  // CORS
  const origin = event.headers.origin || event.headers.referer || '';
  const allowedOrigins = ['https://dropcharge.io', 'https://dropchargeadmin.netlify.app', 'http://localhost:8000', 'http://localhost:3000'];
  const corsHeaders = allowedOrigins.some(o => origin.includes(o))
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
    : {};

  // Handle OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ ok: false, error: 'Method not allowed' })
    };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ ok: false, error: 'invalid_json', details: err.message })
    };
  }

  const email = (payload.email || '').trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ ok: false, error: 'invalid_email', details: 'Email format invalid' })
    };
  }

  if (!hasSupabase || !supabase) {
    console.log('subscribe: Supabase not configured');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ ok: false, error: 'unavailable', details: 'Storage not configured' })
    };
  }

  try {
    // Check if subscriber exists
    const { data: existing, error: selectErr } = await supabase
      .from('newsletter_subscribers')
      .select('id, status')
      .eq('email', email)
      .maybeSingle();

    if (selectErr && selectErr.code !== 'PGRST116') {
      console.log('subscribe: select error', selectErr.message, selectErr.code);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ ok: false, error: 'database_error', details: selectErr.message })
      };
    }

    // If exists and active, return success
    if (existing && existing.status === 'active') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ ok: true, message: 'already_subscribed' })
      };
    }

    // If exists but unsubscribed, reactivate
    if (existing && existing.status === 'unsubscribed') {
      const { error: updateErr } = await supabase
        .from('newsletter_subscribers')
        .update({
          status: 'active',
          unsubscribed_at: null
        })
        .eq('id', existing.id);

      if (updateErr) {
        console.log('subscribe: update error', updateErr.message);
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          body: JSON.stringify({ ok: false, error: 'database_error', details: updateErr.message })
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ ok: true, message: 'resubscribed' })
      };
    }

    // New subscriber: insert
    const { error: insertErr } = await supabase.from('newsletter_subscribers').insert({
      email,
      status: 'active',
      source: payload.source || 'popup',
      utm_source: payload.utm?.utm_source || null,
      utm_campaign: payload.utm?.utm_campaign || null,
      utm_medium: payload.utm?.utm_medium || null,
      utm_content: payload.utm?.utm_content || null,
      utm_term: payload.utm?.utm_term || null,
      meta: {
        page: payload.page || '/'
      },
      created_at: new Date().toISOString()
    });

    if (insertErr) {
      console.log('subscribe: insert error', insertErr.message);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ ok: false, error: 'database_error', details: insertErr.message })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ ok: true, message: 'subscribed_v2', email, timestamp: new Date().toISOString() })
    };
  } catch (err) {
    console.error('[subscribe] Unexpected error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ ok: false, error: 'unexpected_error', message: err.message, stack: err.stack })
    };
  }
};
