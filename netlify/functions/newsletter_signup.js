const { supabase, hasSupabase } = require('./_lib/supabase');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

exports.handler = async function(event) {
  console.log('[newsletter_signup] Received request:', { method: event.httpMethod, body: event.body?.substring(0, 100) });
  
  if (event.httpMethod !== 'POST') {
    console.log('[newsletter_signup] Not a POST request');
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Method not allowed' })
    };
  }

  // CORS
  const origin = event.headers.origin || event.headers.referer || '';
  const allowedOrigins = ['https://dropcharge.io', 'https://dropchargeadmin.netlify.app'];
  const corsHeaders = allowedOrigins.some(o => origin.includes(o))
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' }
    : {};

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
    console.log('newsletter_signup: Supabase not configured', { hasSupabase, supabaseClient: !!supabase });
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ ok: false, error: 'unavailable', details: 'Storage not configured' })
    };
  }

  try {
    console.log('[newsletter_signup] Querying for existing subscriber:', email);
    // Check if subscriber exists
    const { data: existing, error: selectErr } = await supabase
      .from('newsletter_subscribers')
      .select('id, status')
      .eq('email', email)
      .maybeSingle();

    if (selectErr && selectErr.code !== 'PGRST116') {
      console.log('newsletter_signup: select error', selectErr.message, selectErr.code);
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
          unsubscribed_at: null,
          meta: {
            resubscribed_at: new Date().toISOString(),
            ...(payload.utm ? { utm: payload.utm } : {})
          }
        })
        .eq('id', existing.id);

      if (updateErr) {
        console.log('newsletter_signup: update error', updateErr.message);
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
        page: payload.page || '/',
        ...(payload.utm ? { utm: payload.utm } : {})
      },
      created_at: new Date().toISOString()
    });

    if (insertErr) {
      console.log('newsletter_signup: insert error', insertErr.message);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ ok: false, error: 'database_error', details: insertErr.message })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ ok: true, message: 'subscribed' })
    };
  } catch (err) {
    console.error('[newsletter_signup] Unexpected error:', err.message, err.stack);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ ok: false, error: 'unexpected_error', details: err.message })
    };
  }
};
