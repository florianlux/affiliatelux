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

    // Return stored HTML or regenerate
    let htmlContent = data.metadata?.html_content;

    if (!htmlContent) {
      // Regenerate if not stored
      const { generateModernProductPage } = require('./_lib/products-auto');
      htmlContent = generateModernProductPage({
        asin: data.amazon_asin,
        title: data.product_name,
        image: data.product_image,
        description: data.description,
        price: data.price,
        rating: data.metadata?.rating,
        pageSlug: data.page_slug,
        amazonUrl: data.amazon_url
      }, data.affiliate_key);
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
