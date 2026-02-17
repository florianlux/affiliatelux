# DealLux Onepager

Schneller Affiliate-Onepager (Preisvergleich / Deals) – optimiert für Social Traffic.

## Struktur
```
price-compare-site/
├── index.html          # Onepager
├── assets/
│   └── styles.css      # Custom Styles (Space Grotesk, Dark Theme)
└── README.md
```

## Anpassen
1. Öffne `index.html` und ersetze die Platzhalter-Links (`https://example.com/affiliateX`).
2. Passen die Deal-Karten im Abschnitt „Heute sparen bei“ und die Kategorie-Pills an.
3. Im FAQ/Footer kann Impressum/DSGVO eingetragen werden.
4. Optional: Ersetze Testimonials und Newsletter-Formular (z. B. mit Mailerlite/Formspree).

## Hosting
- **Schnelltest lokal:**
  ```bash
  cd price-compare-site
  python3 -m http.server 8080
  ```
  → `http://localhost:8080`

- **Statisches Hosting:** Zip-Ordner oder Git-Repo hochladen auf Netlify, Vercel, Cloudflare Pages oder GitHub Pages.

## Next Steps
- JSON-basierte Linkliste + kleines JS, um Kategorien dynamisch zu füllen.
- SEO-Meta (Open Graph, Twitter Cards) ergänzen.
- CTA-Tracking (z. B. Plausible, Umami) integrieren.
- TikTok-Link-in-Bio hinterlegen und regelmäßig aktualisieren.
