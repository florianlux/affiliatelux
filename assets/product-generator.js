/**
 * Product Page Generator
 * Generates HTML pages with affiliate links
 */

class ProductGenerator {
  constructor(apiClient, toast) {
    this.api = apiClient;
    this.toast = toast;
    this.form = document.getElementById('product-gen-form');
    this.preview = document.getElementById('product-preview');
    this.init();
  }

  init() {
    this.form?.addEventListener('submit', (e) => this.handleGenerateClick(e));
    document.getElementById('copy-html-btn')?.addEventListener('click', () => this.copyToClipboard('html'));
    document.getElementById('copy-url-btn')?.addEventListener('click', () => this.copyToClipboard('url'));
    document.getElementById('download-html-btn')?.addEventListener('click', () => this.downloadHTML());
  }

  async handleGenerateClick(event) {
    event.preventDefault();
    const formData = new FormData(this.form);
    const data = Object.fromEntries(formData.entries());

    // Validation
    if (!data.productName || !data.slug || !data.affiliateKey) {
      this.toast.error('Produktname, Slug und Affiliate Key sind erforderlich');
      return;
    }

    // Save to local state for preview
    this.currentProduct = data;
    this.generatePreview(data);
  }

  generatePreview(data) {
    const html = this.generateHTML(data);
    
    // Update preview elements
    document.getElementById('preview-title').textContent = data.productName;
    document.getElementById('preview-price').textContent = data.price || 'Preis auf Anfrage';
    document.getElementById('preview-description').textContent = data.description || 'Entdecke dieses fantastische Produkt!';
    document.getElementById('code-content').textContent = html;
    
    // Show preview
    this.preview.style.display = 'block';
    this.preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    this.toast.success('✓ Seite generiert');
  }

  generateHTML(data) {
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
    } = data;

    const affiliateSlug = `${slug}-${affiliateKey}`;

    return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${productName} - DropCharge Deals</title>
  <meta name="description" content="${description || productName}">
  <meta property="og:title" content="${productName}">
  <meta property="og:description" content="${description || 'Entdecke dieses fantastische Angebot!'}">
  ${coverUrl ? `<meta property="og:image" content="${coverUrl}">` : ''}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Space Grotesk', system-ui, sans-serif; background: #01020a; color: #f9fbff; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; }
    .container { max-width: 600px; width: 100%; }
    .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 2.5rem; backdrop-filter: blur(16px); }
    ${coverUrl ? `
    .cover { width: 100%; height: 300px; background: linear-gradient(135deg, rgba(255,199,106,0.1), rgba(124,224,164,0.1)), url('${coverUrl}') center/cover; border-radius: 16px; margin-bottom: 1.5rem; }
    ` : ''}
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    .price { font-size: 1.8rem; color: #ffc76a; font-weight: 700; margin: 1rem 0; }
    .description { color: #b0b9d3; line-height: 1.6; margin: 1.5rem 0; }
    .links { display: grid; gap: 0.8rem; margin: 2rem 0; }
    .link-btn { display: inline-block; padding: 1rem 1.5rem; background: rgba(255,199,106,0.1); border: 1px solid #ffc76a; color: #ffc76a; border-radius: 12px; text-decoration: none; text-align: center; font-weight: 600; transition: all 0.3s ease; }
    .link-btn:hover { background: rgba(255,199,106,0.2); transform: translateY(-2px); }
    .footer { text-align: center; color: #9ea8c3; font-size: 0.85rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.05); }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${coverUrl ? `<div class="cover"></div>` : ''}
      <h1>${productName}</h1>
      ${price ? `<div class="price">${price}</div>` : ''}
      ${description ? `<p class="description">${description}</p>` : ''}
      
      <div class="links">
        ${amazonUrl ? `<a href="/.netlify/functions/go?target=${encodeURIComponent(amazonUrl)}&affiliate=${encodeURIComponent(affiliateKey)}" class="link-btn">🛒 Bei Amazon kaufen</a>` : ''}
        ${g2gUrl ? `<a href="/.netlify/functions/go?target=${encodeURIComponent(g2gUrl)}&affiliate=${encodeURIComponent(affiliateKey)}" class="link-btn">🎮 Bei G2G kaufen</a>` : ''}
        ${otherUrl ? `<a href="/.netlify/functions/go?target=${encodeURIComponent(otherUrl)}&affiliate=${encodeURIComponent(affiliateKey)}" class="link-btn">🔗 Zum Angebot</a>` : ''}
      </div>

      <div class="footer">
        <p>💡 Affiliate-Links • Transparente Preisvergleiche • Unterstütze DropCharge</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  copyToClipboard(type) {
    let text = '';
    let btn = null;

    if (type === 'html') {
      text = document.getElementById('code-content').textContent;
      btn = document.getElementById('copy-html-btn');
    } else if (type === 'url') {
      text = `${window.location.origin}/product/${this.currentProduct.slug}-${this.currentProduct.affiliateKey}.html`;
      btn = document.getElementById('copy-url-btn');
    }

    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        this.toast.success('✓ Kopiert!');
        if (btn) {
          btn.classList.add('copied');
          btn.textContent = type === 'html' ? '✓ Kopiert!' : '✓ URL kopiert!';
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.textContent = type === 'html' ? '📋 HTML kopieren' : '🔗 URL kopieren';
          }, 2000);
        }
      });
    }
  }

  downloadHTML() {
    const html = document.getElementById('code-content').textContent;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentProduct.slug}-${this.currentProduct.affiliateKey}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.toast.success('✓ Datei heruntergeladen');
  }
}

// Export für externe Nutzung
window.ProductGenerator = ProductGenerator;
