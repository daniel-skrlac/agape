import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { absoluteUrl } from '../lib/site';
import { noticeSlug } from '../lib/notices';

const staticPages = [
  '/',
  '/obavijesti/',
  '/o-nama/',
  '/kako-pomoci/',
  '/volonteri/',
  '/kontakt/',
  '/politika-privatnosti/',
  '/izjava-o-pristupacnosti/'
];

export const GET: APIRoute = async () => {
  const notices = await getCollection('obavijesti', ({ data }) => !data.draft);
  const noticeUrls = notices.map((notice) => `/obavijesti/${noticeSlug(notice.id)}/`);
  const urls = [...staticPages, ...noticeUrls]
    .map(
      (path) => `  <url>
    <loc>${absoluteUrl(path)}</loc>
  </url>`
    )
    .join('\n');

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
};
