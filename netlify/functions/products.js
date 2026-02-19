/**
 * Netlify Function: Save Generated Product Page
 * Stores product configuration and can generate standalone pages
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminToken = process.env.ADMIN_TOKEN;

const supabase = createClient(supabaseUrl, supabaseKey);

// Verify admin token
const verifyAdminToken = (headers) => {
  const token = headers['x-admin-token'];
  return token && token === adminToken;
};

// Generate HTML for product page
const generateProductHTML = (product) => {
  const {
    productName,
    slug,
    description = 'Entdecke dieses fantastische Produkt!',
    coverUrl = '',
    price = 'Preis auf Anfrage',
    affiliateKey,
    amazonUrl = '',
    g2gUrl = '',
    otherUrl = ''
  } = product;

  const coverStyle = coverUrl 
    ? `background: linear-gradient(135deg, rgba(255,199,106,0.1), rgba(124,224,164,0.1)), url('${coverUrl}') center/cover;`
    : 'background: linear-gradient(135deg, rgba(255,199,106,0.1), rgba(124,224,164,0.1));';

  const linkButtons = [
    amazonUrl ? `<a href="/.netlify/functions/go?target=${encodeURIComponent(amazonUrl)}&affiliate=${encodeURIComponent(affiliateKey)}" class="link-btn">🛒 Bei Amazon kaufen</a>` : '',
    g2gUrl ? `<a href="/.netlify/functions/go?target=${encodeURIComponent(g2gUrl)}&affiliate=${encodeURIComponent(affiliateKey)}" class="link-btn">🎮 Bei G2G kaufen</a>` : '',
    otherUrl ? `<a href="/.netlify/functions/go?target=${encodeURIComponent(otherUrl)}&affiliate=${encodeURIComponent(affiliateKey)}" class="link-btn">🔗 Zum Angebot</a>` : ''
  ].filter(Boolean).join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${productName} - DropCharge</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="index, follow">
  <meta property="og:title" content="${productName}">
  <meta property="og:description" content="${description}">
  ${coverUrl ? `<meta property="og:image" content="${coverUrl}">` : ''}
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${productName}">
  <meta name="twitter:description" content="${description}">
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --bg-primary: #01020a;
      --text-primary: #f9fbff;
      --text-muted: #b0b9d3;
      --accent-primary: #ffc76a;
      --accent-success: #7ce0a4;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      font-family: 'Space Grotesk', system-ui, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      line-height: 1.6;
    }

    .container {
      max-width: 700px;
      width: 100%;
    }

    .card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 2.5rem;
      backdrop-filter: blur(16px);
      animation: slideUp 0.6s ease;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    ${coverUrl ? `.cover {
      width: 100%;
      height: 350px;
      background: ${coverStyle};
      border-radius: 16px;
      margin-bottom: 2rem;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }` : ''}

    h1 {
      font-size: 2.2rem;
      margin-bottom: 0.8rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .price {
      font-size: 1.8rem;
      color: var(--accent-primary);
      font-weight: 700;
      margin: 1.2rem 0;
      padding: 0.8rem 1.2rem;
      background: rgba(255, 199, 106, 0.05);
      border-left: 3px solid var(--accent-primary);
      border-radius: 8px;
    }

    .description {
      color: var(--text-muted);
      line-height: 1.8;
      margin: 1.8rem 0;
      font-size: 1rem;
    }

    .links {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin: 2.5rem 0;
    }

    .link-btn {
      display: inline-block;
      padding: 1.1rem 1.8rem;
      background: rgba(255, 199, 106, 0.1);
      border: 2px solid var(--accent-primary);
      color: var(--accent-primary);
      border-radius: 12px;
      text-decoration: none;
      text-align: center;
      font-weight: 700;
      font-size: 1rem;
      transition: all 0.3s ease;
      cursor: pointer;
      letter-spacing: 0.05em;
    }

    .link-btn:hover {
      background: rgba(255, 199, 106, 0.2);
      transform: translateY(-3px);
      box-shadow: 0 10px 25px rgba(255, 199, 106, 0.15);
    }

    .link-btn:active {
      transform: translateY(-1px);
    }

    .footer {
      text-align: center;
      color: #9ea8c3;
      font-size: 0.9rem;
      margin-top: 2.5rem;
      padding-top: 2rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    .footer p {
      margin: 0.5rem 0;
    }

    .back-link {
      color: var(--accent-primary);
      text-decoration: none;
      font-size: 0.9rem;
      display: inline-block;
      margin-bottom: 1.5rem;
      transition: all 0.3s ease;
    }

    .back-link:hover {
      text-decoration: underline;
      transform: translateX(-3px);
    }

    @media (max-width: 640px) {
      body {
        padding: 1rem;
      }

      .card {
        padding: 1.5rem;
      }

      h1 {
        font-size: 1.8rem;
      }

      .price {
        font-size: 1.5rem;
      }

      ${coverUrl ? `.cover {
        height: 250px;
        margin-bottom: 1.5rem;
      }` : ''}
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="/" class="back-link">← Zurück</a>
    <div class="card">
      ${coverUrl ? `<div class="cover"></div>` : ''}
      <h1>${productName}</h1>
      <div class="price">${price}</div>
      <p class="description">${description}</p>
      
      <div class="links">
        ${linkButtons}
      </div>

      <div class="footer">
        <p>🔗 Affiliate-Links • 💡 Transparente Preisvergleiche</p>
        <p style="margin-top: 1rem; opacity: 0.7;">Powered by DropCharge</p>
      </div>
    </div>
  </div>
</body>
</html>`;
};

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    // GET: Retrieve saved products
    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ products: data || [] })
      };
    }

    // POST: Save new product
    if (event.httpMethod === 'POST') {
      if (!verifyAdminToken(event.headers)) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Unauthorized' })
        };
      }

      const body = JSON.parse(event.body);
      const {
        productName,
        slug,
        description,
        coverUrl,
        price,
        affiliateKey,
        amazonUrl,
        g2gUrl,
        otherUrl
      } = body;

      // Validate required fields
      if (!productName || !slug || !affiliateKey) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing required fields' })
        };
      }

      // Insert into database
      const { data, error } = await supabase.from('products').insert([{
        product_name: productName,
        slug,
        description,
        cover_url: coverUrl,
        price,
        affiliate_key: affiliateKey,
        amazon_url: amazonUrl,
        g2g_url: g2gUrl,
        other_url: otherUrl,
        html_content: generateProductHTML(body),
        created_at: new Date().toISOString()
      }]).select();

      if (error) throw error;

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          success: true,
          product: data[0],
          pageUrl: `/${slug}-${affiliateKey}.html`
        })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (err) {
    console.error('Product API Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
