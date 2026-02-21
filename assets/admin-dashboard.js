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
      emailFilter: document.getElementById('email-filter'),
      emailExport: document.getElementById('email-export'),
      emailClearAll: document.getElementById('email-clear-all'),
      healthStatusEl: document.querySelector('[data-health-status]'),
      healthErrorEl: document.querySelector('[data-health-error]'),
      healthTable: document.getElementById('health-clicks'),
      feed: document.getElementById('feed'),
      refreshBtn: document.getElementById('refresh'),
      spotlightForm: document.getElementById('spotlight-form'),
      spotlightFetchBtn: document.getElementById('spotlight-fetch'),
      clearTokenBtn: document.getElementById('admin-clear-token'),
      spotlightPreview: document.getElementById('spotlight-preview'),
      newsletterForm: document.getElementById('newsletter-form'),
      newsletterStatus: document.getElementById('newsletter-status'),
      newsletterCount: document.getElementById('newsletter-count'),
      newsletterProgress: document.getElementById('newsletter-progress'),
      newsletterProgressText: document.getElementById('newsletter-progress-text'),
      newsletterProgressBar: document.getElementById('newsletter-progress-bar'),
      newsletterSubmit: document.getElementById('newsletter-submit'),
      leadsTable: document.getElementById('leads-table'),
      leadsFilter: document.getElementById('leads-filter'),
      leadsSearch: document.getElementById('leads-search'),
      leadsRefresh: document.getElementById('leads-refresh'),
      leadsExport: document.getElementById('leads-export'),
      leadsCount: document.getElementById('leads-count'),
      leadsPageInfo: document.getElementById('leads-page-info'),
      leadsPrev: document.getElementById('leads-prev'),
      leadsNext: document.getElementById('leads-next')
    };
    
    this.allEmails = [];
    this.leadsPage = 1;
    this.leadsPageSize = 50;
    this.leadsTotalPages = 1;
  }

  attachEventListeners() {
    this.elements.clearTokenBtn?.addEventListener('click', () => {
      localStorage.removeItem(this.api.tokenKey);
      window.location.href = '/admin-login.html';
    });

    this.elements.refreshBtn?.addEventListener('click', () => this.refresh());
    this.elements.spotlightFetchBtn?.addEventListener('click', () => this.loadSpotlight());
    this.elements.spotlightForm?.addEventListener('submit', (e) => this.handleSpotlightSubmit(e));

    // Email actions
    this.elements.emailFilter?.addEventListener('change', (e) => this.filterEmails(e.target.value));
    this.elements.emailExport?.addEventListener('click', () => this.exportEmails());
    this.elements.emailClearAll?.addEventListener('click', () => this.deleteAllEmails());

    // Newsletter
    this.elements.newsletterForm?.addEventListener('submit', (e) => this.handleNewsletterSubmit(e));

    // Leads
    this.elements.leadsRefresh?.addEventListener('click', () => this.loadLeads());
    this.elements.leadsFilter?.addEventListener('change', () => { this.leadsPage = 1; this.loadLeads(); });
    this.elements.leadsSearch?.addEventListener('change', () => { this.leadsPage = 1; this.loadLeads(); });
    this.elements.leadsExport?.addEventListener('click', () => this.exportLeads());
    this.elements.leadsPrev?.addEventListener('click', () => { this.leadsPage = Math.max(1, this.leadsPage - 1); this.loadLeads(); });
    this.elements.leadsNext?.addEventListener('click', () => { this.leadsPage = Math.min(this.leadsTotalPages, this.leadsPage + 1); this.loadLeads(); });
  }

  startLiveUpdates() {
    this.refresh().then(() => {
      this.lastEntryId = window.__lastEntries?.[0]?.id || null;
    });

    setInterval(() => this.refresh(), this.refreshInterval);
    setInterval(() => this.loadHealth(), this.healthInterval);
    setInterval(() => this.loadLeads(), 30000); // Update leads every 30 seconds
    
    // Initial health check and loads
    this.loadHealth();
    this.loadLeads();
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
      this.allEmails = emails;
      this.elements.emailTable.querySelectorAll('.table-row').forEach(row => row.remove());
      emails.forEach(email => {
        const row = this.createEmailRow(
          email.id,
          email.email,
          new Date(email.created_at).toLocaleString(),
          email.status === 'active' ? '✓ Active' : (email.status || 'Pending')
        );
        this.elements.emailTable.appendChild(row);
      });
    }

    // Update newsletter count
    if (this.elements.newsletterCount) {
      const confirmedCount = emails.filter(e => e.status === 'active').length;
      this.elements.newsletterCount.textContent = confirmedCount;
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

  createEmailRow(id, email, timestamp, status) {
    const row = document.createElement('div');
    row.className = 'table-row email-row';
    row.dataset.emailId = id;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'email-row-delete';
    deleteBtn.textContent = '🗑️ Löschen';
    deleteBtn.addEventListener('click', () => this.deleteEmail(id, email));
    
    row.innerHTML = `
      <span>${email}</span>
      <span>${timestamp}</span>
      <span>${status}</span>
      <span id="action-${id}"></span>
    `;
    
    const actionCell = row.querySelector(`#action-${id}`);
    actionCell.appendChild(deleteBtn);
    
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

  filterEmails(status) {
    const emailRows = this.elements.emailTable.querySelectorAll('.email-row');
    
    emailRows.forEach(row => {
      if (!status) {
        row.style.display = 'grid';
      } else {
        const statusCell = row.querySelector('span:nth-child(3)');
        const isConfirmed = statusCell.textContent.includes('✓');
        const matches = (status === 'confirmed' && isConfirmed) || (status === 'pending' && !isConfirmed);
        row.style.display = matches ? 'grid' : 'none';
      }
    });
  }

  exportEmails() {
    if (!this.allEmails || this.allEmails.length === 0) {
      this.toast.error('Keine E-Mails zum Exportieren');
      return;
    }

    // Filter berücksichtigen
    const filterValue = this.elements.emailFilter?.value || '';
    let emailsToExport = this.allEmails;
    
    if (filterValue) {
      emailsToExport = emailsToExport.filter(email => {
        if (filterValue === 'active') return email.status === 'active';
        if (filterValue === 'unsubscribed') return email.status === 'unsubscribed';
        return true;
      });
    }

    // CSV-Header
    let csv = 'Email,Timestamp,Status\n';
    
    // CSV-Zeilen
    emailsToExport.forEach(email => {
      const date = new Date(email.created_at).toLocaleString();
      const status = email.status === 'active' ? 'Active' : (email.status || 'Pending');
      csv += `"${email.email}","${date}","${status}"\n`;
    });

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `newsletters-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    
    this.toast.success(`✓ ${emailsToExport.length} E-Mails exportiert`);
  }

  async deleteEmail(emailId, email) {
    if (!confirm(`Möchtest du ${email} wirklich löschen?`)) {
      return;
    }

    const response = await this.api.fetch('/delete-email', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId })
    });

    if (response?.success) {
      this.toast.success(`✓ E-Mail gelöscht`);
      const row = document.querySelector(`[data-email-id="${emailId}"]`);
      if (row) row.remove();
      this.allEmails = this.allEmails.filter(e => e.id !== emailId);
    } else {
      this.toast.error('E-Mail konnte nicht gelöscht werden');
    }
  }

  async deleteAllEmails() {
    if (!this.allEmails || this.allEmails.length === 0) {
      this.toast.error('Keine E-Mails zum Löschen');
      return;
    }

    const filterValue = this.elements.emailFilter?.value || '';
    let emailsToDelete = this.allEmails;
    
    if (filterValue) {
      emailsToDelete = emailsToDelete.filter(email => {
        if (filterValue === 'active') return email.status === 'active';
        if (filterValue === 'unsubscribed') return email.status === 'unsubscribed';
        return true;
      });
    }

    if (!confirm(`Möchtest du ${emailsToDelete.length} E-Mail(s) wirklich löschen? Dies kann nicht rückgängig gemacht werden!`)) {
      return;
    }

    let successCount = 0;
    for (const email of emailsToDelete) {
      const response = await this.api.fetch('/delete-email', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId: email.id })
      });

      if (response?.success) {
        successCount++;
        const row = document.querySelector(`[data-email-id="${email.id}"]`);
        if (row) row.remove();
      }
    }

    this.allEmails = this.allEmails.filter(e => !emailsToDelete.find(d => d.id === e.id));
    this.toast.success(`✓ ${successCount}/${emailsToDelete.length} E-Mails gelöscht`);
  }

  async handleNewsletterSubmit(event) {
    event.preventDefault();

    const confirmedCount = this.allEmails.filter(e => e.confirmed).length;
    if (confirmedCount === 0) {
      this.toast.error('Keine bestätigten E-Mails vorhanden');
      return;
    }

    const formData = new FormData(this.elements.newsletterForm);
    const payload = Object.fromEntries(formData.entries());

    if (!confirm(`Newsletter an ${confirmedCount} E-Mail(s) versenden? Dies kann nicht rückgängig gemacht werden!`)) {
      return;
    }

    // UI Update
    this.elements.newsletterStatus.textContent = 'Versenden...';
    this.elements.newsletterStatus.classList.add('sending');
    this.elements.newsletterSubmit.disabled = true;
    this.elements.newsletterProgress.style.display = 'block';
    this.elements.newsletterProgressText.textContent = 'Verarbeite...';
    this.elements.newsletterProgressBar.style.width = '0%';

    try {
      const response = await this.api.fetch('/send-newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response?.success) {
        const { sent = 0, failed = 0, total = 0 } = response;
        this.elements.newsletterProgressBar.style.width = '100%';
        this.elements.newsletterProgressText.textContent = `✓ ${sent}/${total} erfolgreich versendet`;
        
        if (failed > 0) {
          this.toast.error(`⚠️ ${failed} E-Mails konnten nicht versendet werden`);
        } else {
          this.toast.success(`✓ Newsletter an ${sent} E-Mail(s) versendet!`);
        }

        this.elements.newsletterForm.reset();
        
        setTimeout(() => {
          this.elements.newsletterProgress.style.display = 'none';
          this.elements.newsletterStatus.textContent = 'Versendet';
          this.elements.newsletterStatus.classList.remove('sending');
          
          setTimeout(() => {
            this.elements.newsletterStatus.textContent = 'Ready';
            this.elements.newsletterStatus.classList.remove('sending');
          }, 3000);
        }, 1500);
      } else {
        throw new Error(response?.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Newsletter error:', err);
      this.elements.newsletterStatus.textContent = 'Fehler';
      this.elements.newsletterStatus.classList.add('error');
      this.elements.newsletterProgressText.textContent = `Fehler: ${err.message}`;
      this.toast.error('Newsletter konnte nicht versendet werden');
    } finally {
      this.elements.newsletterSubmit.disabled = false;
    }
  }

  async loadLeads() {
    const status = this.elements.leadsFilter?.value || 'all';
    const search = this.elements.leadsSearch?.value || '';
    
    const query = new URLSearchParams({
      status,
      search,
      page: this.leadsPage,
      limit: this.leadsPageSize
    }).toString();

    const data = await this.api.fetch(`/admin-list-leads?${query}`);
    if (data) this.renderLeads(data);
  }

  renderLeads(data) {
    const { items = [], total = 0, page = 1, pages = 1 } = data;

    if (this.elements.leadsCount) {
      this.elements.leadsCount.textContent = total;
    }

    if (this.elements.leadsPageInfo) {
      this.elements.leadsPageInfo.textContent = `${page} / ${pages}`;
    }

    this.leadsTotalPages = pages;
    
    if (this.elements.leadsPrev) {
      this.elements.leadsPrev.disabled = page <= 1;
      this.elements.leadsPrev.style.opacity = page <= 1 ? '0.3' : '0.7';
    }
    
    if (this.elements.leadsNext) {
      this.elements.leadsNext.disabled = page >= pages;
      this.elements.leadsNext.style.opacity = page >= pages ? '0.3' : '0.7';
    }

    if (this.elements.leadsTable) {
      this.elements.leadsTable.querySelectorAll('.table-row').forEach(row => row.remove());
      items.forEach(lead => {
        const sentAt = lead.last_sent_at ? new Date(lead.last_sent_at).toLocaleString() : '—';
        const createdAt = lead.created_at ? new Date(lead.created_at).toLocaleString() : '—';
        const row = this.createTableRow(
          lead.email,
          `<span style="color: ${lead.status === 'active' ? 'var(--accent-success)' : 'var(--accent-error)'};">${lead.status}</span>`,
          lead.source || '—',
          createdAt,
          sentAt
        );
        row.className = 'table-row leads-row';
        this.elements.leadsTable.appendChild(row);
      });
    }
  }

  async exportLeads() {
    const status = this.elements.leadsFilter?.value || 'all';
    const search = this.elements.leadsSearch?.value || '';
    
    const query = new URLSearchParams({ status, search }).toString();
    const url = `/.netlify/functions/admin-export-leads?${query}`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `newsletter-leads-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    this.toast.success('✓ Leads exported');
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
