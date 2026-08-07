# Socka Website

Production-oriented Astro website for **Socijalna samoposluga "Kruh sv. Antuna" Varaždin**.

Public website content is Croatian. Code, configuration and developer documentation are English.

## Requirements

- Node.js 22 or newer
- npm

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

For LAN/mobile testing:

```bash
npm run dev:host
```

The Astro/Vite watcher configuration intentionally ignores heavy generated folders and keeps the existing Linux polling fix for limited watcher resources.

## Production Build

```bash
npm run check
npm run build
npm start
```

Set `PUBLIC_SITE_URL` for production canonical URLs, sitemap and social previews:

```bash
PUBLIC_SITE_URL=https://example.org npm run build
```

`npm start` runs the generated standalone Node server from `dist/server/entry.mjs`. Build the project before starting it. `npm run preview` is useful for a local preview, but it is not the long-running production command.

For an always-on Linux laptop with automatic startup, restart handling and Cloudflare Tunnel, follow [`docs/old-laptop-hosting.md`](docs/old-laptop-hosting.md). A reusable `systemd` unit is included at [`deploy/systemd/socka-website.service.example`](deploy/systemd/socka-website.service.example).

## Docker

Build a static production image served by Nginx:

```bash
docker build --build-arg PUBLIC_SITE_URL=https://example.org -t socka-website .
docker run --rm -p 8080:80 socka-website
```

Nginx configuration lives in `nginx.conf` and includes static asset caching, gzip and basic security headers.

Important: the Astro project is configured with `output: "server"` and the Node adapter. Donation API routes for Stripe and HUB3 bank codes require the generated Node server. The current Dockerfile serves the build through Nginx as static files, so it is not suitable for production donations until it is changed to run the Astro Node server.

## Donation Setup

Donation routes use server-side environment variables. Do not expose Stripe secret keys, webhook secrets, Product IDs or Price IDs with a `PUBLIC_` prefix.

Stripe online donations:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_ONE_TIME_ENABLED=true
STRIPE_MONTHLY_ENABLED=true
PUBLIC_STRIPE_CUSTOMER_PORTAL_URL=https://billing.stripe.com/p/login/...
```

`PUBLIC_STRIPE_CUSTOMER_PORTAL_URL` is the Stripe-hosted Customer Portal login link. When configured, the site shows donors a secure way to update their payment method, view receipts or cancel monthly support. Use the portal link from the same Stripe environment as the donations and redeploy after changing it.

Monthly donations must use one Dashboard-configured Product as the source of truth:

- Product name: `Mjesečna donacija`
- Description: `Mjesečna donacija Socijalnoj samoposluzi`
- Image: upload `public/stripe_logo.png` manually in Stripe
- Statement descriptor: `SOCKA DONACIJA`
- Unit label: leave empty
- Metadata: leave empty unless there is a later internal requirement
- Marketing feature list: leave empty
- Pricing: recurring, EUR, monthly

Create reusable monthly Prices on that same Product for:

- €5 monthly
- €10 monthly
- €20 monthly
- €50 monthly

Then configure:

```bash
STRIPE_MONTHLY_PRODUCT_ID=prod_...
STRIPE_MONTHLY_PRICE_5=price_...
STRIPE_MONTHLY_PRICE_10=price_...
STRIPE_MONTHLY_PRICE_20=price_...
STRIPE_MONTHLY_PRICE_50=price_...
```

Custom monthly amounts do not need separate Dashboard Prices. The site creates dynamic monthly `price_data` attached to `STRIPE_MONTHLY_PRODUCT_ID`, so Stripe still uses the same Product name, description, image and statement descriptor.

Test and live Stripe resources are separate: `sk_test_...` works only with sandbox Product/Price IDs, and `sk_live_...` works only with live Product/Price IDs. Restart or redeploy the site after changing donation environment variables.

## Editable Site Data

Core organization data is centralized in:

```text
src/lib/site.ts
```

Edit this file for:

- navigation
- verified contact information
- social links
- donation categories
- current urgent appeals
- historical impact numbers
- gallery images

Do not publish schedules, IBAN, current coordinators, current partner lists or urgent needs until they are verified from a current official source.

## Social Links

Social links are configured in `src/lib/site.ts`.

Links are shown only when `url` is present and `verified` is `true`. WhatsApp is supported but hidden until a valid invitation URL is confirmed.

Social icons are rendered from the maintained `simple-icons` package so the public links use recognizable brand marks without pulling in a UI framework.

## Announcements

Announcements are Markdown files in:

```text
src/content/obavijesti/
```

Use the template:

```text
templates/obavijest-template.md
```

Required frontmatter:

```yaml
title: "Naslov obavijesti"
description: "Kratak opis za karticu."
pubDate: 2026-06-15
image: "/images/obavijesti/slika.webp"
imageAlt: "Opis slike"
category: "Obavijest"
featured: false
draft: true
sourceUrl:
imageCredit:
```

Change `draft: true` to `draft: false` only when the information is ready for public publication.

## Announcement Images

Place images in:

```text
public/images/obavijesti/
```

Use descriptive file names, optimize images before committing them and write Croatian alt text. Do not hotlink social media or news images.

## Contact Information

Address, phone and email are published from the 2026 supplied material documented in `docs/content-sources.md`. Current schedules, IBAN, coordinators, live needs and partner lists still require confirmation before publication.

## Validation

Run:

```bash
npm install
npm run check
npm run build
```

`npm run check` uses Astro's official `@astrojs/check` package.

## Deployment

Deployment-ready files:

- `Dockerfile`
- `.dockerignore`
- `nginx.conf`
- `.env.example`

Configure `PUBLIC_SITE_URL` in the deployment environment. No secrets are required by default.

## Source Research

The source audit, extracted facts, inaccessible sources, unpublished facts and image usage notes are documented in:

```text
docs/content-sources.md
```

## Knjiga „Putovanje kroz Italiju”

U repozitoriju se nalazi i zaseban, cjelovit projekt hrvatske povijesno-kulturne knjige s Markdown izvorom, slikama, bibliografijom te PDF i DOCX izdanjem.

- Upute i napomene: [`book/README.md`](book/README.md)
- Završni PDF: [`book/output/putovanje-kroz-italiju.pdf`](book/output/putovanje-kroz-italiju.pdf)
- Završni DOCX: [`book/output/putovanje-kroz-italiju.docx`](book/output/putovanje-kroz-italiju.docx)
- Ponovna izrada: `.book-venv/bin/python scripts/build_book.py`
