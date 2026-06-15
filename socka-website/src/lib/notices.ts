import { getCollection } from 'astro:content';

export const noticesPerPage = 9;

export async function getPublishedNotices() {
  const notices = await getCollection('obavijesti', ({ data }) => !data.draft);
  return notices.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

export async function getFeaturedNotices() {
  const notices = await getPublishedNotices();
  return notices.filter((notice) => notice.data.featured);
}

export function getNoticeCategories(
  notices: Awaited<ReturnType<typeof getPublishedNotices>>
) {
  return [...new Set(notices.map((notice) => notice.data.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'hr')
  );
}

export function paginateNotices<T>(items: T[], page = 1, perPage = noticesPerPage) {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * perPage;
  return {
    currentPage,
    totalPages,
    items: items.slice(start, start + perPage)
  };
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
