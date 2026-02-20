/**
 * Netlify Function: Serve Auto Product Pages
 * Handles redirects and displays product pages
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  try {
    const pageSlug = event.path.split('/').filter(Boolean).pop();

    if (!pageSlug) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html' },
        body: '<h1>Produkt nicht gefunden</h1>'
      };
    }

    // Fetch product by slug
    const { data, error } = await supabase
      .from('auto_products')
      .select('*')
      .eq('page_slug', pageSlug)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html' },
        body: '<h1>Produkt nicht gefunden</h1>'
      };
    }

    // Increment view count
    await supabase
      .from('auto_products')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('id', data.id)
      .catch(err => console.error('Update count error:', err));

    // Return stored HTML
    let htmlContent = data.metadata?.html_content;

    if (!htmlContent) {
      // Fallback if HTML not stored
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${data.product_name}</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; max-width: 800px; margin: auto;">
          <img src="${data.product_image}" style="max-width: 100%; margin-bottom: 20px;" alt="${data.product_name}">
          <h1>${data.product_name}</h1>
          <p style="font-size: 24px; font-weight: bold; color: #2ecc71;">${data.price || 'Preis nicht verfügbar'}</p>
          <p>${data.description || ''}</p>
          <p style="margin-top: 30px;"><a href="${data.amazon_url}" style="padding: 12px 24px; background: #FF9900; color: white; text-decoration: none; border-radius: 4px; display: inline-block;">Auf Amazon kaufen</a></p>
        </body>
        </html>
      `;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      },
      body: htmlContent
    };

  } catch (err) {
    console.error('Error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: '<h1>Fehler beim Laden der Seite</h1>'
    };
  }
};
