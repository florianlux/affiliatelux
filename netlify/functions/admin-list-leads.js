const { requireAdmin } = require('./_lib/admin-token');
const { supabase, hasSupabase } = require('./_lib/supabase');

exports.handler = async function(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: 'Storage not configured' };
  }

  try {
    // Parse query parameters
    const params = new URLSearchParams(event.rawQuery || '');
    const status = params.get('status') || 'all';
    const search = params.get('search') || '';
    const page = Math.max(1, parseInt(params.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('newsletter_subscribers')
      .select('id,email,status,source,created_at,last_sent_at,unsubscribed_at,meta', { count: 'exact' });

    // Filter by status
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Search by email
    if (search) {
      query = query.ilike('email', `%${search}%`);
    }

    // Order and paginate
    const { data: leads = [], count = 0, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.log('admin-list-leads error', error.message);
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        items: leads,
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit)
      })
    };
  } catch (err) {
    console.log('admin-list-leads handler error', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
