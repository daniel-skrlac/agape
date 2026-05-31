import { getCollection } from 'astro:content';

export async function getPublishedNotices() {
  const notices = await getCollection('obavijesti', ({ data }) => !data.draft);
  return notices.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

export function noticeSlug(id: string) {
  return id.replace(/\.mdx?$/, '');
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('hr-HR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
}
