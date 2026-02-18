const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');

async function fetchLatestSpotlight() {
  if (!hasSupabase || !supabase) {
    throw new Error('Storage not configured');
  }
  const { data, error } = await supabase
    .from('spotlights')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    throw error;
  }
  return data && data.length ? data[0] : null;
}

async function handleGet() {
  try {
    const spotlight = await fetchLatestSpotlight();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spotlight })
    };
  } catch (err) {
    console.log('spotlight get error', err.message);
    return { statusCode: 500, body: 'Failed to load spotlight' };
  }
}

async function handlePost(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: 'Storage not configured' };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid payload' };
  }

  if (!payload.title) {
    return { statusCode: 400, body: 'Title required' };
  }

  const record = {
    title: payload.title,
    cover_url: payload.cover_url || null,
    description: payload.description || null,
    amazon_url: payload.amazon_url || null,
    g2g_url: payload.g2g_url || null,
    release_date: payload.release_date || null,
    price: payload.price || null,
    created_at: new Date().toISOString()
  };

  const { error } = await supabase.from('spotlights').insert(record);
  if (error) {
    console.log('spotlight insert error', error.message);
    return { statusCode: 500, body: 'Failed to save spotlight' };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true })
  };
}

exports.handler = async function(event) {
  if (event.httpMethod === 'GET') {
    return handleGet();
  }

  if (event.httpMethod === 'POST') {
    return handlePost(event);
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
