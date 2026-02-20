/**
 * Netlify Function: Auto Product Generator
 * Parses Amazon links and generates modern product pages
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminToken = process.env.ADMIN_TOKEN;

const supabase = createClient(supabaseUrl, supabaseKey);

// Verify admin token
const verifyAdminToken = (headers) => {
  const token = headers['x-admin-token'];
  return token && token === adminToken;
};

// Extract product info from HTML using multiple methods
const extractProductInfo = (html, asin) => {
  const result = {
    title: null,
    image: null,
    description: null,
    price: null,
    rating: null
  };

  if (!html || html.length < 100) {
    console.warn('HTML too small or empty:', html?.length || 0);
    return result;
  }

  try {
    // Method 1: OpenGraph tags (most reliable)
    const ogTitle = html.match(/<meta property="og:title" content="([^"]*)"/i);
    const ogImage = html.match(/<meta property="og:image" content="([^"]*)"/i);
    const ogDesc = html.match(/<meta property="og:description" content="([^"]*)"/i);
    
    result.title = ogTitle?.[1];
    result.image = ogImage?.[1];
    result.description = ogDesc?.[1];

    // Method 2: Meta tags (fallback)
    if (!result.title) {
      const metaTitle = html.match(/<meta name="title" content="([^"]*)"/) || 
                       html.match(/<title>([^<]*)<\/title>/i);
      result.title = metaTitle?.[1];
    }

    if (!result.description) {
      const metaDesc = html.match(/<meta name="description" content="([^"]*)"/) ||
                      html.match(/<meta property="description" content="([^"]*)"/);
      result.description = metaDesc?.[1];
    }

    // Method 3: JSON-LD structured data
    try {
      const jsonLdMatches = html.match(/<script type="application\/ld\+json"[^>]*>([^<]+)<\/script>/gi);
      if (jsonLdMatches) {
        for (const m of jsonLdMatches) {
          try {
            const json = JSON.parse(m.replace(/<[^>]*>/g, ''));
            if (json.name) result.title = result.title || json.name;
            if (json.description) result.description = result.description || json.description;
            
            if (json.image) {
              if (Array.isArray(json.image)) {
                result.image = result.image || json.image[0];
              } else if (typeof json.image === 'string') {
                result.image = result.image || json.image;
              }
            }
            
            if (json.offers?.price) result.price = result.price || json.offers.price;
            if (json.aggregateRating?.ratingValue) result.rating = result.rating || parseFloat(json.aggregateRating.ratingValue);
          } catch (e) {
            // Continue to next JSON-LD block
          }
        }
      }
    } catch (e) {
      console.warn('JSON-LD parse error:', e.message);
    }

    // Method 4: Extract first large image
    if (!result.image) {
      const imgMatch = html.match(/<img[^>]*src="([^"]*(?:\.jpg|\.png|\.webp)[^"]*)"/i) ||
                      html.match(/<img[^>]*data-src="([^"]*(?:\.jpg|\.png|\.webp)[^"]*)"/i);
      if (imgMatch?.[1] && imgMatch[1].length > 10) {
        result.image = imgMatch[1];
      }
    }

    // Method 5: Price extraction
    if (!result.price) {
      const pricePatterns = [
        /["']price["']\s*:\s*["']?(\d+[.,]\d{2})/i,
        /€\s*(\d+[.,]\d{2})/,
        /EUR\s*(\d+[.,]\d{2})/i,
        /(\d+[.,]\d{2})\s*EUR/i
      ];
      for (const p of pricePatterns) {
        const m = html.match(p);
        if (m?.[1]) {
          result.price = m[1].replace(',', '.');
          break;
        }
      }
    }

    // Method 6: Rating extraction
    if (!result.rating) {
      const ratingPatterns = [
        /ratingValue['"]\s*:\s*['""]?([0-9.]+)/i,
        /rating['"]\s*:\s*['""]?([0-9.]+)/i,
        /([0-9.]+)['"]\s*von\s*['""]?5/i
      ];
      for (const p of ratingPatterns) {
        const m = html.match(p);
        if (m?.[1]) {
          result.rating = parseFloat(m[1]);
          break;
        }
      }
    }

    // Method 7: Cleanup extracted data
    if (result.title) {
      result.title = decodeHTMLEntities(result.title)
        .replace(/<[^>]*>/g, '')
        .trim()
        .substring(0, 200);
    }

    if (result.description) {
      result.description = decodeHTMLEntities(result.description)
        .replace(/<[^>]*>/g, '')
        .trim()
        .substring(0, 300);
    }

    console.log('✓ Extract result:', {
      title: result.title ? `✓ ${result.title.substring(0, 40)}...` : '✗',
      image: result.image ? '✓' : '✗',
      price: result.price ? `✓ ${result.price}` : '✗',
      rating: result.rating ? `✓ ${result.rating}` : '✗'
    });

  } catch (err) {
    console.error('Extract error:', err.message);
  }

  return result;
};

// Extract ASIN from Amazon URL - supports multiple formats
const extractASIN = (url) => {
  try {
    // Normalize URL
    url = url.trim();

    // Check if it's just an ASIN
    if (/^[A-Z0-9]{10}$/.test(url)) {
      return url;
    }

    // Format: /dp/ASIN
    let match = url.match(/\/dp\/([A-Z0-9]{10})/i);
    if (match) return match[1].toUpperCase();

    // Format: /gp/product/ASIN
    match = url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
    if (match) return match[1].toUpperCase();

    // Format: /B... (as ASIN directly in URL)
    match = url.match(/(B[A-Z0-9]{9})/i);
    if (match) return match[1].toUpperCase();

    // Format: ASIN=... or asin=...
    match = url.match(/[?&]asin[=:]([A-Z0-9]{10})/i);
    if (match) return match[1].toUpperCase();

    return null;
  } catch (err) {
    console.error('ASIN extract error:', err);
    return null;
  }
};

// Decode HTML entities
const decodeHTMLEntities = (text) => {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&apos;': "'",
    '&nbsp;': ' '
  };
  return text.replace(/&[a-z]+;|&#\d+;/gi, (match) => entities[match] || match);
};

// Generate modern HTML for product page
const generateModernProductPage = (product, affiliateKey) => {
  const {
    asin,
    title,
    image,
    description,
    price,
    rating,
    pageSlug,
    amazonUrl
  } = product;

  const affiliateLink = `${amazonUrl}?tag=dropcharge-${affiliateKey}`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - DropCharge Shop</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  ${image ? `<meta property="og:image" content="${image}">` : ''}
  <meta property="og:type" content="product">
  <meta property="og:url" content="https://dropcharge.shop/${pageSlug}">
  <meta name="twitter:card" content="product">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  ${image ? `<meta name="twitter:image" content="${image}">` : ''}
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
      -webkit-font-smoothing: antialiased;
    }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%);
      color: #fff;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .navbar {
      padding: 1rem 2rem;
      background: rgba(15, 15, 30, 0.8);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo {
      font-size: 1.3rem;
      font-weight: 800;
      background: linear-gradient(135deg, #ff6b6b, #ffa500);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -1px;
    }

    main {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }

    .product-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      overflow: hidden;
      max-width: 500px;
      width: 100%;
      backdrop-filter: blur(20px);
      animation: slideIn 0.6s ease;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .product-image {
      width: 100%;
      height: 360px;
      background: linear-gradient(135deg, rgba(255, 107, 107, 0.1), rgba(255, 165, 0, 0.1));
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
    }

    .product-image img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 2rem;
    }

    .product-image::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(to bottom, transparent, rgba(15, 15, 30, 0.4));
    }

    .product-content {
      padding: 2.5rem;
    }

    .badge {
      display: inline-block;
      padding: 0.4rem 1rem;
      background: rgba(255, 107, 107, 0.15);
      color: #ff6b6b;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 1rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    h1 {
      font-size: 1.8rem;
      font-weight: 700;
      line-height: 1.3;
      margin-bottom: 1rem;
      letter-spacing: -0.5px;
    }

    .rating {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1.2rem;
      font-size: 0.95rem;
    }

    .stars {
      color: #ffa500;
      font-size: 1rem;
    }

    .price-section {
      display: flex;
      align-items: baseline;
      gap: 0.8rem;
      margin: 1.5rem 0;
      padding: 1.2rem;
      background: linear-gradient(135deg, rgba(255, 107, 107, 0.1), rgba(255, 165, 0, 0.05));
      border-radius: 12px;
      border: 1px solid rgba(255, 107, 107, 0.2);
    }

    .price {
      font-size: 2.2rem;
      font-weight: 800;
      background: linear-gradient(135deg, #ff6b6b, #ffa500);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .currency {
      font-size: 1rem;
      color: rgba(255, 255, 255, 0.7);
    }

    .description {
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.7;
      margin-bottom: 1.5rem;
      font-size: 0.95rem;
    }

    .cta-button {
      width: 100%;
      padding: 1.2rem;
      background: linear-gradient(135deg, #ff6b6b, #ffa500);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s ease;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      box-shadow: 0 10px 30px rgba(255, 107, 107, 0.3);
    }

    .cta-button:hover {
      transform: translateY(-3px);
      box-shadow: 0 15px 40px rgba(255, 107, 107, 0.4);
    }

    .cta-button:active {
      transform: translateY(-1px);
    }

    .features {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    .feature {
      text-align: center;
      padding: 1rem;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .feature-icon {
      font-size: 1.8rem;
      margin-bottom: 0.5rem;
    }

    .feature-title {
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.7);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }

    footer {
      text-align: center;
      padding: 2rem;
      color: rgba(255, 255, 255, 0.4);
      font-size: 0.85rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    @media (max-width: 640px) {
      main {
        padding: 1rem;
      }

      .product-card {
        border-radius: 16px;
      }

      .product-content {
        padding: 1.5rem;
      }

      h1 {
        font-size: 1.5rem;
      }

      .price {
        font-size: 1.8rem;
      }

      .cta-button {
        padding: 1rem;
        font-size: 0.9rem;
      }

      .features {
        grid-template-columns: 1fr;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      * {
        animation: none !important;
        transition: none !important;
      }
    }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="logo">DROP🔥</div>
    <span style="font-size: 0.8rem; color: #ffa500;">Affiliate Deals</span>
  </nav>

  <main>
    <div class="product-card">
      ${image ? `
      <div class="product-image">
        <img src="${image}" alt="${title}" loading="lazy">
      </div>
      ` : ''}

      <div class="product-content">
        <span class="badge">🔥 Top Deal</span>
        
        <h1>${title}</h1>
        
        ${rating ? `
        <div class="rating">
          <span class="stars">${'★'.repeat(Math.round(rating))}${'☆'.repeat(5 - Math.round(rating))}</span>
          <span>(${rating} / 5)</span>
        </div>
        ` : ''}

        ${price ? `
        <div class="price-section">
          <span class="price">${price}</span>
          <span class="currency">EUR</span>
        </div>
        ` : ''}

        <p class="description">${description}</p>

        <a href="/.netlify/functions/go?target=${encodeURIComponent(affiliateLink)}&slug=${pageSlug}" class="cta-button">
          🛒 Jetzt kaufen auf Amazon
        </a>

        <div class="features">
          <div class="feature">
            <div class="feature-icon">✅</div>
            <div class="feature-title">Verifiziert</div>
          </div>
          <div class="feature">
            <div class="feature-icon">🚚</div>
            <div class="feature-title">Schnelle Lieferung</div>
          </div>
          <div class="feature">
            <div class="feature-icon">🔒</div>
            <div class="feature-title">Sicher</div>
          </div>
          <div class="feature">
            <div class="feature-icon">💰</div>
            <div class="feature-title">Best Price</div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <footer>
    <p>💡 DropCharge • Transparente Deals • Affiliate Links helfen uns, mehr Content zu erstellen</p>
    <p style="margin-top: 0.5rem; opacity: 0.5;">Powered by DropCharge Automation</p>
  </footer>

  <script>
    // Track page view
    fetch('/.netlify/functions/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'product_view',
        product_slug: '${pageSlug}',
        referrer: document.referrer
      })
    }).catch(() => {});

    // Track CTA click
    document.querySelector('.cta-button').addEventListener('click', () => {
      fetch('/.netlify/functions/track-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'product_click',
          product_slug: '${pageSlug}',
          referrer: document.referrer
        })
      }).catch(() => {});
    });
  </script>
</body>
</html>`;
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    // POST: Create auto product from Amazon link
    if (event.httpMethod === 'POST') {
      if (!verifyAdminToken(event.headers)) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      let body = {};
      try {
        body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }

      const { amazonUrl, affiliateKey, customTitle, customImage, customDescription } = body;

      if (!amazonUrl?.trim() || !affiliateKey?.trim()) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Amazon URL und Affiliate Key erforderlich' })
        };
      }

      const asin = extractASIN(amazonUrl.trim());
      if (!asin) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Konnte ASIN nicht extrahieren. Bitte gib einen Amazon Link oder ASIN ein (z.B. B07FZG4C8F)' })
        };
      }

      console.log('✓ Extracted ASIN:', asin);
      let productInfo = null;
      
      try {
        let fetchUrl = amazonUrl.trim().split('?')[0];
        console.log('→ Attempting to fetch:', fetchUrl);
        
        // Try to resolve shortened URLs
        if (fetchUrl.includes('amzn.to') || fetchUrl.includes('amzn.eu')) {
          try {
            const resolved = await fetch(fetchUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
              redirect: 'follow',
              timeout: 10000
            });
            if (resolved.ok) fetchUrl = resolved.url;
          } catch (e) {
            console.warn('Could not resolve shortened URL:', e.message);
          }
        }

        // Use clean Amazon URL
        if (asin) {
          fetchUrl = `https://www.amazon.de/dp/${asin}`;
        }

        console.log('→ Final fetch URL:', fetchUrl);
        
        const response = await fetch(fetchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'de-DE,de;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
          },
          redirect: 'follow',
          timeout: 12000
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        console.log('✓ Got HTML, length:', html.length);

        productInfo = extractProductInfo(html, asin);
        console.log('✓ Extracted info:', {
          title: productInfo.title ? '✓' : '✗',
          image: productInfo.image ? '✓' : '✗',
          price: productInfo.price ? '✓' : '✗'
        });

      } catch (err) {
        console.warn('⚠ Scraping error:', err.message);
        productInfo = {
          title: customTitle || `Amazon Produkt ${asin}`,
          image: customImage || null,
          description: customDescription || 'Premium-Produkt auf Amazon verfügbar'
        };
        console.log('→ Using fallback data');
      }

      // Ensure all fields exist
      productInfo = {
        title: productInfo?.title || customTitle || `Amazon ASIN: ${asin}`,
        image: productInfo?.image || customImage || null,
        description: productInfo?.description || customDescription || 'Entdecke dieses Produkt auf Amazon',
        price: productInfo?.price || null,
        rating: productInfo?.rating || null
      };

      const pageSlug = `${asin.toLowerCase()}-${Date.now()}`;
      const cleanUrl = amazonUrl.split('?')[0].split('#')[0];

      const product = {
        asin,
        amazonUrl: cleanUrl,
        ...productInfo,
        pageSlug,
        affiliate_key: affiliateKey
      };

      // Generate HTML
      const htmlContent = generateModernProductPage(product, affiliateKey);

      console.log('→ Saving to Supabase...');

      // Save to Supabase
      const { data, error } = await supabase
        .from('auto_products')
        .insert([{
          amazon_asin: asin,
          amazon_url: cleanUrl,
          product_name: productInfo.title,
          product_image: productInfo.image,
          description: productInfo.description,
          price: productInfo.price,
          rating: productInfo.rating,
          affiliate_key: affiliateKey,
          page_slug: pageSlug,
          status: 'active',
          metadata: { html_content: htmlContent }
        }])
        .select();

      if (error) {
        console.error('✗ DB Error:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Fehler beim Speichern: ' + error.message })
        };
      }

      console.log('✓ Product saved successfully');

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          success: true,
          product: data[0],
          pageUrl: `/${pageSlug}`,
          shareUrl: `${process.env.URL || 'https://affiliatelux.netlify.app'}/${pageSlug}`,
          htmlDownload: htmlContent
        })
      };
    }

    // GET: List products
    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase
        .from('auto_products')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('DB Error:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: error.message })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ products: data || [] })
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (err) {
    console.error('✗ Fatal error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Unbekannter Fehler' })
    };
  }
};
