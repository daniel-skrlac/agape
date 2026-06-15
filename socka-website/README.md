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
npm run preview
```

Set `PUBLIC_SITE_URL` for production canonical URLs, sitemap and social previews:

```bash
PUBLIC_SITE_URL=https://example.org npm run build
```

## Docker

Build a static production image served by Nginx:

```bash
docker build --build-arg PUBLIC_SITE_URL=https://example.org -t socka-website .
docker run --rm -p 8080:80 socka-website
```

Nginx configuration lives in `nginx.conf` and includes static asset caching, gzip and basic security headers.

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
