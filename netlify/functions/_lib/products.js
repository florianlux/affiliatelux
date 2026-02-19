/**
 * Shared product utilities for Netlify functions
 */

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
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root { --bg: #01020a; --text: #f9fbff; --muted: #b0b9d3; --accent: #ffc76a; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Space Grotesk', system-ui, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; }
    .container { max-width: 700px; width: 100%; }
    .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 2.5rem; backdrop-filter: blur(16px); }
    ${coverUrl ? `.cover { width: 100%; height: 350px; background: linear-gradient(135deg, rgba(255,199,106,0.1), rgba(124,224,164,0.1)), url('${coverUrl}') center/cover; border-radius: 16px; margin-bottom: 2rem; }` : ''}
    h1 { font-size: 2.2rem; margin-bottom: 0.8rem; font-weight: 700; }
    .price { font-size: 1.8rem; color: var(--accent); font-weight: 700; margin: 1.2rem 0; padding: 0.8rem 1.2rem; background: rgba(255,199,106,0.05); border-left: 3px solid var(--accent); }
    .description { color: var(--muted); line-height: 1.8; margin: 1.8rem 0; }
    .links { display: flex; flex-direction: column; gap: 1rem; margin: 2.5rem 0; }
    .link-btn { display: block; padding: 1.1rem 1.8rem; background: rgba(255,199,106,0.1); border: 2px solid var(--accent); color: var(--accent); border-radius: 12px; text-decoration: none; text-align: center; font-weight: 700; transition: all 0.3s ease; }
    .link-btn:hover { background: rgba(255,199,106,0.2); transform: translateY(-3px); }
    .footer { text-align: center; color: #9ea8c3; margin-top: 2.5rem; padding-top: 2rem; border-top: 1px solid rgba(255,255,255,0.05); font-size: 0.9rem; }
    @media (max-width: 640px) { .card { padding: 1.5rem; } h1 { font-size: 1.8rem; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${coverUrl ? `<div class="cover"></div>` : ''}
      <h1>${productName}</h1>
      <div class="price">${price}</div>
      <p class="description">${description}</p>
      <div class="links">${linkButtons}</div>
      <div class="footer">🔗 DropCharge Affiliate Links</div>
    </div>
  </div>
</body>
</html>`;
};

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
  <meta name="twitter:card" content="product">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  ${image ? `<meta name="twitter:image" content="${image}">` : ''}
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
    body { font-family: 'Inter', system-ui, sans-serif; background: linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%); color: #fff; min-height: 100vh; display: flex; flex-direction: column; }
    .navbar { padding: 1rem 2rem; background: rgba(15, 15, 30, 0.8); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(255, 255, 255, 0.05); display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 1.3rem; font-weight: 800; background: linear-gradient(135deg, #ff6b6b, #ffa500); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: -1px; }
    main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem; }
    .product-card { background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; overflow: hidden; max-width: 500px; width: 100%; backdrop-filter: blur(20px); animation: slideIn 0.6s ease; box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3); }
    @keyframes slideIn { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    .product-image { width: 100%; height: 360px; background: linear-gradient(135deg, rgba(255, 107, 107, 0.1), rgba(255, 165, 0, 0.1)); display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .product-image img { width: 100%; height: 100%; object-fit: contain; padding: 2rem; }
    .product-content { padding: 2.5rem; }
    .badge { display: inline-block; padding: 0.4rem 1rem; background: rgba(255, 107, 107, 0.15); color: #ff6b6b; border-radius: 20px; font-size: 0.85rem; font-weight: 600; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.5px; }
    h1 { font-size: 1.8rem; font-weight: 700; line-height: 1.3; margin-bottom: 1rem; letter-spacing: -0.5px; }
    .rating { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.2rem; font-size: 0.95rem; }
    .stars { color: #ffa500; font-size: 1rem; }
    .price-section { display: flex; align-items: baseline; gap: 0.8rem; margin: 1.5rem 0; padding: 1.2rem; background: linear-gradient(135deg, rgba(255, 107, 107, 0.1), rgba(255, 165, 0, 0.05)); border-radius: 12px; border: 1px solid rgba(255, 107, 107, 0.2); }
    .price { font-size: 2.2rem; font-weight: 800; background: linear-gradient(135deg, #ff6b6b, #ffa500); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .currency { font-size: 1rem; color: rgba(255, 255, 255, 0.7); }
    .description { color: rgba(255, 255, 255, 0.7); line-height: 1.7; margin-bottom: 1.5rem; font-size: 0.95rem; }
    .cta-button { width: 100%; padding: 1.2rem; background: linear-gradient(135deg, #ff6b6b, #ffa500); color: white; border: none; border-radius: 12px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: all 0.3s ease; letter-spacing: 0.5px; text-transform: uppercase; box-shadow: 0 10px 30px rgba(255, 107, 107, 0.3); }
    .cta-button:hover { transform: translateY(-3px); box-shadow: 0 15px 40px rgba(255, 107, 107, 0.4); }
    .features { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 2rem; padding-top: 2rem; border-top: 1px solid rgba(255, 255, 255, 0.05); }
    .feature { text-align: center; padding: 1rem; border-radius: 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); }
    .feature-icon { font-size: 1.8rem; margin-bottom: 0.5rem; }
    .feature-title { font-size: 0.85rem; color: rgba(255, 255, 255, 0.7); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    footer { text-align: center; padding: 2rem; color: rgba(255, 255, 255, 0.4); font-size: 0.85rem; border-top: 1px solid rgba(255, 255, 255, 0.05); }
    @media (max-width: 640px) { main { padding: 1rem; } h1 { font-size: 1.5rem; } .price { font-size: 1.8rem; } .features { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="logo">DROP🔥</div>
    <span style="font-size: 0.8rem; color: #ffa500;">Affiliate Deals</span>
  </nav>

  <main>
    <div class="product-card">
      ${image ? `<div class="product-image"><img src="${image}" alt="${title}" loading="lazy"></div>` : ''}
      <div class="product-content">
        <span class="badge">🔥 Top Deal</span>
        <h1>${title}</h1>
        ${rating ? `<div class="rating"><span class="stars">${'★'.repeat(Math.round(rating))}${'☆'.repeat(5 - Math.round(rating))}</span><span>(${rating} / 5)</span></div>` : ''}
        ${price ? `<div class="price-section"><span class="price">${price}</span><span class="currency">EUR</span></div>` : ''}
        <p class="description">${description}</p>
        <a href="/.netlify/functions/go?target=${encodeURIComponent(affiliateLink)}&slug=${pageSlug}" class="cta-button">🛒 Jetzt kaufen auf Amazon</a>
        <div class="features">
          <div class="feature"><div class="feature-icon">✅</div><div class="feature-title">Verifiziert</div></div>
          <div class="feature"><div class="feature-icon">🚚</div><div class="feature-title">Schnelle Lieferung</div></div>
          <div class="feature"><div class="feature-icon">🔒</div><div class="feature-title">Sicher</div></div>
          <div class="feature"><div class="feature-icon">💰</div><div class="feature-title">Best Price</div></div>
        </div>
      </div>
    </div>
  </main>

  <footer>
    <p>💡 DropCharge • Transparente Deals • Affiliate Links helfen uns, mehr Content zu erstellen</p>
    <p style="margin-top: 0.5rem; opacity: 0.5;">Powered by DropCharge Automation</p>
  </footer>

  <script>
    fetch('/.netlify/functions/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'product_view', product_slug: '${pageSlug}', referrer: document.referrer })
    }).catch(() => {});
  </script>
</body>
</html>`;
};

module.exports = {
  generateProductHTML,
  generateModernProductPage
};

