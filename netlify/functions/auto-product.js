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

  try {
    // Method 1: OpenGraph tags
    const getOGTag = (property) => {
      const regex = new RegExp(`<meta property="og:${property}" content="([^"]*)"`, 'i');
      const match = html.match(regex);
      return match ? match[1] : null;
    };

    result.title = getOGTag('title');
    result.image = getOGTag('image');
    result.description = getOGTag('description');

    // Method 2: Meta tags fallback
    const getMetaTag = (name) => {
      const regex = new RegExp(`<meta name="${name}" content="([^"]*)"`, 'i');
      const match = html.match(regex);
      return match ? match[1] : null;
    };

    if (!result.title) {
      result.title = getMetaTag('title');
    }

    if (!result.description) {
      result.description = getMetaTag('description');
    }

    // Method 3: Find title in h1 tag
    if (!result.title) {
      const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (h1Match) result.title = decodeHTMLEntities(h1Match[1]).trim();
    }

    // Method 4: Structured data (JSON-LD) with better parsing
    try {
      const jsonLdMatches = html.match(/<script type="application\/ld\+json"[^>]*>([^<]+)<\/script>/gi);
      if (jsonLdMatches) {
        for (const match of jsonLdMatches) {
          try {
            const jsonStr = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
            const jsonLd = JSON.parse(jsonStr);
            
            if (jsonLd.name) result.title = result.title || jsonLd.name;
            if (jsonLd.description) result.description = result.description || jsonLd.description;
            
            // Handle various image formats
            if (jsonLd.image) {
              if (Array.isArray(jsonLd.image)) {
                result.image = result.image || jsonLd.image[0];
              } else if (typeof jsonLd.image === 'object') {
                result.image = result.image || jsonLd.image.url;
              } else {
                result.image = result.image || jsonLd.image;
              }
            }
            
            // Extract price
            if (jsonLd.offers) {
              const offers = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
              if (offers.price) result.price = offers.price;
            }
            
            // Extract rating
            if (jsonLd.aggregateRating?.ratingValue) {
              result.rating = parseFloat(jsonLd.aggregateRating.ratingValue);
            }
          } catch (e) {
            console.warn('JSON-LD parse error (item):', e.message);
          }
        }
      }
    } catch (e) {
      console.warn('JSON-LD parse error:', e.message);
    }

    // Method 5: Image extraction from multiple sources
    if (!result.image) {
      // Try to find image in img tags
      const imgMatches = [
        html.match(/<img[^>]*data-a-dynamic-image='([^']*)'[^>]*>/i),
        html.match(/<img[^>]*src='([^']*[a-zA-Z0-9]+\.(jpg|png|jpeg|webp))'[^>]*>/i),
        html.match(/<img[^>]*class='[^']*s-image[^']*'[^>]*src='([^']*)'[^>]*>/i)
      ];
      
      for (const match of imgMatches) {
        if (match && match[1]) {
          try {
            const imgUrl = match[1];
            if (imgUrl.includes('.jpg') || imgUrl.includes('.png') || imgUrl.includes('.webp')) {
              result.image = imgUrl;
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }
    }

    // Method 6: Price extraction from various patterns
    if (!result.price) {
      const pricePatterns = [
        /data-a-color="price"[^>]*>€?\s*(\d+[.,]\d{2})/i,
        /class="[^"]*price[^"]*"[^>]*>€?\s*(\d+[.,]\d{2})/i,
        /["']?price["']?\s*:\s*["']?(\d+[.,]\d{2})["']?/i,
        /EUR\s*(\d+[.,]\d{2})/i,
        /€\s*(\d+[.,]\d{2})/i,
        /(\d+[.,]\d{2})\s*EUR/i
      ];
      for (const pattern of pricePatterns) {
        const match = html.match(pattern);
        if (match) {
          result.price = match[1].replace(',', '.');
          break;
        }
      }
    }

    // Method 7: Rating extraction
    if (!result.rating) {
      const ratingPatterns = [
        /rating['"]\s*:\s*["']?([0-9.]+)/i,
        /ratingValue['"]\s*:\s*["']?([0-9.]+)/i,
        /aria-label="([0-9.]+) von 5 Sternen"/i,
        /([0-9.]+) out of 5/i
      ];
      for (const pattern of ratingPatterns) {
        const match = html.match(pattern);
        if (match) {
          result.rating = parseFloat(match[1]);
          break;
        }
      }
    }

    // Method 8: Description cleanup from text-heavy content
    if (!result.description && html.length > 1000) {
      // Extract first meaningful paragraph
      const textMatch = html.match(/<p[^>]*>([^<]{20,200})<\/p>/i);
      if (textMatch) {
        result.description = decodeHTMLEntities(textMatch[1]).substring(0, 160).trim();
      }
    }

    // Final cleanup
    if (result.title) {
      result.title = decodeHTMLEntities(result.title).trim().substring(0, 200);
    }

    if (result.description) {
      result.description = decodeHTMLEntities(result.description).substring(0, 200).trim();
    }

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

      const { amazonUrl, affiliateKey, customTitle, customImage, customDescription } = JSON.parse(event.body);

      if (!amazonUrl || !affiliateKey) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Amazon URL and affiliate key required' })
        };
      }

      const asin = extractASIN(amazonUrl);
      if (!asin) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Konnte ASIN nicht extrahieren. Bitte überprüfe deine Amazon-URL. Sie sollte /dp/ASIN enthalten oder direkt eine ASIN sein.' })
        };
      }

      console.log('Extracted ASIN:', asin);

      // Fetch product info with better timeout and error handling
      let productInfo = null;
      
      try {
        let fetchUrl = amazonUrl.split('?')[0].trim(); // Remove query params
        console.log('Step 1: Original URL:', fetchUrl);
        
        // Handle shortened Amazon URLs by resolving them
        if (fetchUrl.includes('amzn.to') || fetchUrl.includes('amzn.eu')) {
          console.log('Step 2: Detected shortened URL, attempting to resolve...');
          try {
            const resolveResponse = await fetch(fetchUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              },
              redirect: 'follow'
            });
            
            if (resolveResponse.ok) {
              const resolvedUrl = resolveResponse.url;
              console.log('Step 3: Resolved to:', resolvedUrl);
              fetchUrl = resolvedUrl;
            }
          } catch (resolveErr) {
            console.warn('Step 3: Resolution failed:', resolveErr.message);
          }
        }

        // Extract ASIN to build clean URL if needed
        const asinFromUrl = extractASIN(fetchUrl);
        if (asinFromUrl) {
          // Build clean Amazon URL
          fetchUrl = `https://www.amazon.de/dp/${asinFromUrl}`;
          console.log('Step 4: Using clean Amazon URL:', fetchUrl);
        }
        
        console.log('Step 5: Fetching page...');
        const response = await fetch(fetchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          },
          redirect: 'follow',
          timeout: 15000
        });

        console.log('Step 6: Response status:', response.status, response.statusText);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status } - ${response.statusText}`);
        }

        const html = await response.text();
        console.log('Step 7: HTML received, length:', html.length);

        // Extract product info using multiple methods
        productInfo = extractProductInfo(html, asin);
        console.log('Step 8: Extracted info:', productInfo);

      } catch (err) {
        console.error('⚠️ Scraping failed:', err.message);
        // Use fallback with just ASIN
        productInfo = {
          title: customTitle || `Amazon Produkt ${asin}`,
          image: customImage || null,
          description: customDescription || 'Hochwertiges Produkt auf Amazon - entdecke es jetzt!'
        };
        console.log('Step 9: Using fallback data:', productInfo);
      }

      const pageSlug = `${asin.toLowerCase()}-${Date.now()}`;

      const product = {
        asin,
        amazonUrl: amazonUrl.split('?')[0],
        ...productInfo,
        pageSlug,
        affiliate_key: affiliateKey
      };

      // Generate HTML
      const htmlContent = generateModernProductPage(product, affiliateKey);

      // Save to Supabase
      const { data, error } = await supabase
        .from('auto_products')
        .insert([{
          amazon_asin: asin,
          amazon_url: amazonUrl.split('?')[0],
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
        console.error('DB Error:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Fehler beim Speichern: ' + error.message })
        };
      }

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          success: true,
          product: data[0],
          pageUrl: `/${pageSlug}`,
          shareUrl: `${process.env.URL}/${pageSlug}` || `/${pageSlug}`,
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

      if (error) throw error;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ products: data || [] })
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (err) {
    console.error('Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
