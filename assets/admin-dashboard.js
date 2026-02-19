/**
 * DropCharge Admin Dashboard
 * Modernized with ES6+ classes and improved architecture
 */

class APIClient {
  constructor() {
    this.tokenKey = 'admin_token';
    this.baseUrl = '/.netlify/functions';
    this.setupTokenProtection();
  }

  setupTokenProtection() {
    if (!localStorage.getItem(this.tokenKey)) {
      window.location.href = '/admin-login.html';
    }
  }

  getHeaders(extra = {}) {
    const headers = { ...extra };
    const token = localStorage.getItem(this.tokenKey);
    if (token) headers['x-admin-token'] = token;
    return headers;
  }

  handleUnauthorized() {
    localStorage.removeItem(this.tokenKey);
    window.location.href = '/admin-login.html';
  }

  async fetch(endpoint, options = {}) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: this.getHeaders(options.headers || {})
      });

      if (response.status === 401) {
        this.handleUnauthorized();
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error(`API Error (${endpoint}):`, err.message);
      return null;
    }
  }
}

class Toast {
  constructor() {
    this.element = this.createToastElement();
    document.body.appendChild(this.element);
  }

  createToastElement() {
    const toast = document.createElement('div');
    toast.id = 'toast';
    return toast;
  }

  show(message, duration = 3500) {
    this.element.textContent = message;
    this.element.style.opacity = '1';
    setTimeout(() => {
      this.element.style.opacity = '0';
    }, duration);
  }

  success(message, duration = 3500) {
    this.show(message, duration);
  }

  error(message, duration = 3500) {
    this.show(`❌ ${message}`, duration);
  }
}

class Dashboard {
  constructor() {
    this.api = new APIClient();
    this.toast = new Toast();
    this.lastEntryId = null;
    this.refreshInterval = 2000;
    this.healthInterval = 8000;
    this.init();
  }

  init() {
    this.cacheDOMElements();
    this.attachEventListeners();
    this.startLiveUpdates();
  }

  cacheDOMElements() {
    this.elements = {
      PSN: document.querySelector('#platform-stats .stat:nth-child(1) strong'),
      Xbox: document.querySelector('#platform-stats .stat:nth-child(2) strong'),
      Nintendo: document.querySelector('#platform-stats .stat:nth-child(3) strong'),
      amountList: document.getElementById('amount-stats'),
      emailCountEl: document.getElementById('email-count'),
      emailConvEl: document.getElementById('email-conv'),
      emailTable: document.getElementById('email-table'),
      healthStatusEl: document.querySelector('[data-health-status]'),
      healthErrorEl: document.querySelector('[data-health-error]'),
      healthTable: document.getElementById('health-clicks'),
      feed: document.getElementById('feed'),
      refreshBtn: document.getElementById('refresh'),
      spotlightForm: document.getElementById('spotlight-form'),
      spotlightFetchBtn: document.getElementById('spotlight-fetch'),
      clearTokenBtn: document.getElementById('admin-clear-token'),
      spotlightPreview: document.getElementById('spotlight-preview')
    };
  }

  attachEventListeners() {
    this.elements.clearTokenBtn?.addEventListener('click', () => {
      localStorage.removeItem(this.api.tokenKey);
      window.location.href = '/admin-login.html';
    });

    this.elements.refreshBtn?.addEventListener('click', () => this.refresh());
    this.elements.spotlightFetchBtn?.addEventListener('click', () => this.loadSpotlight());
    this.elements.spotlightForm?.addEventListener('submit', (e) => this.handleSpotlightSubmit(e));
  }

  startLiveUpdates() {
    this.refresh().then(() => {
      this.lastEntryId = window.__lastEntries?.[0]?.id || null;
    });

    setInterval(() => this.refresh(), this.refreshInterval);
    setInterval(() => this.loadHealth(), this.healthInterval);
    
    // Initial health check
    this.loadHealth();
  }

  async refresh() {
    const data = await this.api.fetch('/stats');
    if (data) this.renderStats(data);
  }

  renderStats(data) {
    const { entries = [], totals = {}, emailCount = 0, conversion = 0, emails = [] } = data;
    window.__lastEntries = entries;

    // Update platform stats
    const platformStats = totals.platform || {};
    if (this.elements.PSN) this.elements.PSN.textContent = platformStats.PSN || 0;
    if (this.elements.Xbox) this.elements.Xbox.textContent = platformStats.Xbox || 0;
    if (this.elements.Nintendo) this.elements.Nintendo.textContent = platformStats.Nintendo || 0;

    // Update email stats
    if (this.elements.emailCountEl) this.elements.emailCountEl.textContent = emailCount;
    if (this.elements.emailConvEl) {
      this.elements.emailConvEl.textContent = (conversion * 100).toFixed(1) + '%';
    }

    // Update email table
    if (this.elements.emailTable) {
      this.elements.emailTable.querySelectorAll('.table-row').forEach(row => row.remove());
      emails.forEach(email => {
        const row = this.createTableRow(
          email.email,
          new Date(email.created_at).toLocaleString(),
          email.confirmed ? '✓ Confirmed' : 'Pending'
        );
        this.elements.emailTable.appendChild(row);
      });
    }

    // Update amount list
    if (this.elements.amountList) {
      this.elements.amountList.innerHTML = '';
      const sorted = Object.entries(totals.amount || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      sorted.forEach(([amount, count]) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `<span>${amount}</span><strong>${count}</strong>`;
        this.elements.amountList.appendChild(item);
      });
    }

    // Update live feed
    if (this.elements.feed) {
      const existingRows = this.elements.feed.querySelectorAll('.table-row');
      existingRows.forEach(row => row.remove());

      entries.forEach((entry, index) => {
        if (index === 0 && entry.id && this.lastEntryId && entry.id !== this.lastEntryId) {
          this.toast.show(`🎯 Neuer Klick auf ${entry.platform} (${entry.amount})`);
          this.lastEntryId = entry.id;
        }

        const row = this.createTableRow(
          new Date(entry.created_at).toLocaleTimeString(),
          entry.slug,
          entry.platform,
          entry.amount,
          entry.country || '—',
          entry.region || '—',
          entry.ip_hash ? entry.ip_hash.slice(0, 12) + '…' : '—',
          `${entry.utm_source || ''} / ${entry.utm_campaign || ''}`
        );
        row.dataset.id = entry.id;
        this.elements.feed.appendChild(row);
      });
    }
  }

  createTableRow(...cells) {
    const row = document.createElement('div');
    row.className = 'table-row';
    row.innerHTML = cells.map(cell => `<span>${cell}</span>`).join('');
    return row;
  }

  async loadHealth() {
    const data = await this.api.fetch('/admin-health');
    if (data) this.renderHealth(data);
  }

  renderHealth(data) {
    const { connected = false, error = '', clicks = [] } = data;

    if (this.elements.healthStatusEl) {
      this.elements.healthStatusEl.textContent = connected ? 'connected' : 'offline';
      this.elements.healthStatusEl.classList.toggle('ok', connected);
      this.elements.healthStatusEl.classList.toggle('fail', !connected);
    }

    if (this.elements.healthErrorEl) {
      this.elements.healthErrorEl.textContent = error ? `Fehler: ${error}` : '';
    }

    if (this.elements.healthTable) {
      this.elements.healthTable.querySelectorAll('.table-row').forEach(row => row.remove());
      clicks.forEach(click => {
        const row = this.createTableRow(
          new Date(click.created_at).toLocaleTimeString(),
          click.slug,
          click.platform || '—',
          click.amount || '—'
        );
        this.elements.healthTable.appendChild(row);
      });
    }
  }

  async loadSpotlight() {
    const data = await this.api.fetch('/spotlight');
    if (data?.spotlight) {
      this.updateSpotlightPreview(data.spotlight);
    }
  }

  updateSpotlightPreview(spotlight = {}) {
    if (!this.elements.spotlightPreview) return;

    const h3 = this.elements.spotlightPreview.querySelector('h3');
    const desc = this.elements.spotlightPreview.querySelector('.desc');
    const meta = this.elements.spotlightPreview.querySelector('.meta');

    if (h3) h3.textContent = spotlight.title || '—';
    if (desc) desc.textContent = spotlight.description || 'Noch kein Spotlight gesetzt.';

    if (meta) {
      const release = spotlight.release_date ? `Release: ${spotlight.release_date}` : 'Unveröffentlicht';
      const price = spotlight.price ? `Preis: ${spotlight.price}` : '';
      meta.innerHTML = [release, price].filter(Boolean).join(' · ');
    }
  }

  async handleSpotlightSubmit(event) {
    event.preventDefault();
    const formData = new FormData(this.elements.spotlightForm);
    const payload = Object.fromEntries(formData.entries());

    const response = await this.api.fetch('/spotlight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response) {
      this.toast.success('✓ Spotlight gespeichert');
      this.elements.spotlightForm.reset();
      this.loadSpotlight();
    } else {
      this.toast.error('Spotlight konnte nicht gespeichert werden');
    }
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const dashboard = new Dashboard();
  
  // Dynamically load modules
  const modules = [
    './assets/product-generator.js',
    './assets/auto-product-generator.js'
  ];
  
  let loadedModules = 0;
  
  modules.forEach(module => {
    const script = document.createElement('script');
    script.src = module;
    document.head.appendChild(script);
    
    script.onload = () => {
      loadedModules++;
      
      if (loadedModules === 1 && window.ProductGenerator) {
        new window.ProductGenerator(dashboard.api, dashboard.toast);
      }
      
      if (loadedModules === 2 && window.AutoProductGenerator) {
        new window.AutoProductGenerator(dashboard.api, dashboard.toast);
      }
    };
  });
});
