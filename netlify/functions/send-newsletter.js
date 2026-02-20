const { requireAdmin } = require('./_lib/admin-token');
const { supabase, hasSupabase } = require('./_lib/supabase');
const { Resend } = require('resend');

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY not configured - newsletter feature disabled');
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

exports.handler = async function(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!process.env.RESEND_API_KEY || !resend) {
    return { statusCode: 500, body: 'Email service not configured' };
  }

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: 'Database not configured' };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid payload' };
  }

  const { subject, html, text, fromName = 'DropCharge', fromEmail = 'noreply@dropcharge.io', replyTo = 'contact@dropcharge.io' } = payload;

  if (!subject || (!html && !text)) {
    return { statusCode: 400, body: 'Subject and content (html or text) required' };
  }

  if (!fromEmail.includes('@')) {
    return { statusCode: 400, body: 'Invalid fromEmail' };
  }

  try {
    // Fetch all confirmed emails
    const { data: emailRows = [], error: fetchErr } = await supabase
      .from('emails')
      .select('id,email')
      .eq('confirmed', true);

    if (fetchErr) {
      console.log('fetch emails error', fetchErr.message);
      return { statusCode: 500, body: 'Failed to fetch emails' };
    }

    if (emailRows.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ success: true, sent: 0, failed: 0, message: 'No confirmed emails to send to' }) };
    }

    const recipientEmails = emailRows.map(e => e.email);
    let sent = 0;
    let failed = 0;

    // Send emails in batches to avoid rate limits
    const batchSize = 50;
    for (let i = 0; i < recipientEmails.length; i += batchSize) {
      const batch = recipientEmails.slice(i, i + batchSize);

      for (const email of batch) {
        try {
          await resend.emails.send({
            from: `${fromName} <${fromEmail}>`,
            to: email,
            subject: subject,
            html: html,
            text: text || undefined,
            reply_to: replyTo
          });
          sent++;
        } catch (err) {
          console.log(`Error sending to ${email}:`, err.message);
          failed++;
        }
      }

      // Small delay between batches
      if (i + batchSize < recipientEmails.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Log to audit log
    if (hasSupabase) {
      await supabase.from('admin_audit_log').insert({
        event: 'newsletter_sent',
        payload: {
          subject,
          sent,
          failed,
          total: recipientEmails.length
        }
      }).catch(err => console.log('audit log error', err.message));
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        sent,
        failed,
        total: recipientEmails.length,
        message: `Newsletter sent to ${sent}/${recipientEmails.length} recipients`
      })
    };
  } catch (err) {
    console.log('send-newsletter error', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
