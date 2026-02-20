const { requireAdmin } = require('./_lib/admin-token');
const { supabase, hasSupabase } = require('./_lib/supabase');

function escapeCSV(field) {
  if (!field) return '';
  if (typeof field === 'object') field = JSON.stringify(field);
  field = String(field);
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

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

    // Build query
    let query = supabase
      .from('newsletter_subscribers')
      .select('id,email,status,source,created_at,last_sent_at,unsubscribed_at,meta');

    // Filter by status
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Search by email
    if (search) {
      query = query.ilike('email', `%${search}%`);
    }

    // Fetch all (up to 10k)
    const { data: leads = [], error } = await query
      .order('created_at', { ascending: false })
      .limit(10000);

    if (error) {
      console.log('admin-export-leads error', error.message);
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    // Generate CSV
    const headers = ['ID', 'Email', 'Status', 'Source', 'Created At', 'Last Sent', 'Unsubscribed At', 'UTM Source', 'UTM Campaign', 'Page'];
    const rows = leads.map(lead => [
      lead.id,
      lead.email,
      lead.status,
      lead.source || '',
      lead.created_at || '',
      lead.last_sent_at || '',
      lead.unsubscribed_at || '',
      lead.utm_source || lead.meta?.utm?.utm_source || '',
      lead.utm_campaign || lead.meta?.utm?.utm_campaign || '',
      lead.meta?.page || ''
    ]);

    const csv = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    const filename = `newsletter-leads-${new Date().toISOString().split('T')[0]}.csv`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      },
      body: csv
    };
  } catch (err) {
    console.log('admin-export-leads handler error', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
