const { requireAdmin } = require('./_lib/admin-token');
const { supabase, hasSupabase } = require('./_lib/supabase');

exports.handler = async function(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: 'Storage not configured' };
  }

  try {
    const { data: recentClicks = [], error: clickErr } = await supabase
      .from('clicks')
      .select('id,slug,platform,amount,utm_source,utm_campaign,referrer,user_agent,country,ip_hash,created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (clickErr) throw clickErr;

    const { count: totalClicks = 0, error: countErr } = await supabase
      .from('clicks')
      .select('id', { count: 'exact', head: true });
    if (countErr) throw countErr;

    const { data: emailRows = [], error: emailErr } = await supabase
      .from('newsletter_subscribers')
      .select('id,email,status,created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50);
    if (emailErr) throw emailErr;

    const { count: totalEmails = 0, error: emailCountErr } = await supabase
      .from('newsletter_subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');
    if (emailCountErr) throw emailCountErr;

    const totals = {
      platform: { PSN: 0, Xbox: 0, Nintendo: 0 },
      amount: {}
    };
    recentClicks.forEach(entry => {
      if (entry.platform && totals.platform[entry.platform] !== undefined) {
        totals.platform[entry.platform] += 1;
      }
      if (entry.amount) {
        totals.amount[entry.amount] = (totals.amount[entry.amount] || 0) + 1;
      }
    });

    const conversion = totalClicks ? totalEmails / totalClicks : 0;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: recentClicks, totals, emailCount: totalEmails, conversion, emails: emailRows })
    };
  } catch (err) {
    console.log('stats error', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
