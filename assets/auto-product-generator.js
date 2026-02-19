/**
 * Auto Product Generator
 * Generates modern product pages from Amazon links
 */

class AutoProductGenerator {
  constructor(apiClient, toast) {
    this.api = apiClient;
    this.toast = toast;
    this.form = document.getElementById('auto-product-form');
    this.preview = document.getElementById('auto-product-preview');
    this.currentProduct = null;
    this.init();
  }

  init() {
    this.form?.addEventListener('submit', (e) => this.handleSubmit(e));
    document.getElementById('copy-page-url-btn')?.addEventListener('click', () => this.copyURL());
    document.getElementById('download-page-btn')?.addEventListener('click', () => this.downloadHTML());
    document.getElementById('preview-page-btn')?.addEventListener('click', () => this.openPreview());
    document.getElementById('refresh-auto-products')?.addEventListener('click', () => this.loadProducts());
    
    // Load products on init
    this.loadProducts();
  }

  async handleSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(this.form);
    const data = Object.fromEntries(formData);

    // Trim whitespace
    data.amazonUrl = (data.amazonUrl || '').trim();
    data.affiliateKey = (data.affiliateKey || '').trim();

    if (!data.amazonUrl || !data.affiliateKey) {
      this.toast.error('Amazon Link und Affiliate Key erforderlich');
      return;
    }

    // Validate Amazon URL - very lenient
    const urlLower = data.amazonUrl.toLowerCase();
    const hasAmazonDomain = urlLower.includes('amazon.') || urlLower.includes('amzn.');
    const hasAsin = /[A-Z0-9]{10}/.test(data.amazonUrl);
    
    if (!hasAmazonDomain && !hasAsin) {
      this.toast.error('❌ Bitte gib einen Amazon Link oder eine ASIN ein (z.B. B07FZG4C8F)');
      return;
    }

    const submitBtn = this.form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Scrape Amazon Daten...';

    try {
      const response = await this.api.fetch('/auto-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      console.log('API Response:', response);

      if (!response || !response.success) {
        const errorMsg = response?.error || 'Unbekannter Fehler beim Generieren';
        console.error('Generation failed:', errorMsg);
        this.toast.error('❌ ' + errorMsg);
        return;
      }

      this.currentProduct = response;
      this.showPreview(response);
      this.toast.success('✅ Produkt-Seite erstellt!');
      this.form.reset();
      
      // Reload product list
      setTimeout(() => this.loadProducts(), 1000);

    } catch (err) {
      console.error('Full error:', err);
      this.toast.error('❌ Fehler: ' + (err.message || 'Bitte versuche es später erneut'));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  showPreview(product) {
    document.getElementById('product-page-url').value = product.pageUrl;
    document.getElementById('share-url').value = product.shareUrl || product.pageUrl;
    this.preview.style.display = 'block';
    this.preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  copyURL() {
    const url = document.getElementById('product-page-url').value;
    navigator.clipboard.writeText(url).then(() => {
      this.toast.success('✓ URL kopiert!');
    });
  }

  downloadHTML() {
    if (!this.currentProduct?.htmlDownload) {
      this.toast.error('Keine HTML-Datei verfügbar');
      return;
    }

    const blob = new Blob([this.currentProduct.htmlDownload], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentProduct.product.page_slug}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.toast.success('✓ Datei heruntergeladen');
  }

  openPreview() {
    if (!this.currentProduct?.pageUrl) return;
    window.open(this.currentProduct.pageUrl, '_blank');
  }

  async loadProducts() {
    try {
      const response = await this.api.fetch('/auto-product');
      if (response?.products) {
        this.renderProductsTable(response.products);
      }
    } catch (err) {
      console.error('Error loading products:', err);
    }
  }

  renderProductsTable(products) {
    const table = document.getElementById('auto-products-table');
    if (!table) return;

    // Remove existing rows
    table.querySelectorAll('.table-row').forEach(el => el.remove());

    if (products.length === 0) {
      const row = document.createElement('div');
      row.className = 'table-row';
      row.innerHTML = '<span colspan="6" style="grid-column: 1/-1;">Noch keine Produkte erstellt</span>';
      table.appendChild(row);
      return;
    }

    products.forEach(product => {
      const row = document.createElement('div');
      row.className = 'table-row';
      
      const date = new Date(product.created_at);
      const dateStr = date.toLocaleDateString('de-DE', { month: 'short', day: 'numeric' });
      
      row.innerHTML = `
        <span title="${product.product_name}">${(product.product_name || product.amazon_asin).substring(0, 30)}</span>
        <span>${product.amazon_asin}</span>
        <span style="color: #7ce0a4;">${product.view_count || 0}</span>
        <span style="color: #ffc76a;">${product.click_count || 0}</span>
        <span style="color: #7ce0a4; text-transform: uppercase; font-size: 0.8rem;">${product.status}</span>
        <span>${dateStr}</span>
      `;
      table.appendChild(row);
    });
  }
}

// Export for external use
window.AutoProductGenerator = AutoProductGenerator;
