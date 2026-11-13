// Public blog API client (server/routes/publicBlog.ts, BLOG_SPEC §5). Used by the blog pages and
// the homepage section; returns only what the server makes public.
import { fetchApi, handleResponse } from './api';
import type { Locale } from '../i18n/types';

export interface PublicBlogCover {
  url: string;
  smallUrl: string | null;
  smallWidth: number | null;
  width: number | null;
  height: number | null;
  alt: string;
}

export interface PublicBlogCategoryRef { slug: string; name: string }

export interface PublicBlogCard {
  locale: Locale;
  slug: string;
  path: string;
  title: string;
  excerpt: string;
  cover: PublicBlogCover | null;
  publishedAt: number | null;
  readingMinutes: number;
  categories: PublicBlogCategoryRef[];
  author: { name: string };
}

export interface PublicBlogList {
  data: PublicBlogCard[];
  category: { slug: string; name: string; description: string; translations: { locale: Locale; slug: string; path: string }[] } | null;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PublicBlogCategory { slug: string; name: string; description: string; postCount: number }

export interface PublicBlogPost extends Omit<PublicBlogCard, 'author'> {
  contentHtml: string;
  updatedAt: number;
  author: { name: string; jobTitle: string; avatarUrl: string | null };
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  translations: { locale: Locale; slug: string; path: string }[];
  previous: { slug: string; path: string; title: string } | null;
  next: { slug: string; path: string; title: string } | null;
  related: PublicBlogCard[];
}

const BASE = '/api/blog';

async function get<T>(path: string): Promise<T> {
  return handleResponse<T>(await fetchApi(path, { cache: 'no-cache' }));
}

export const blogPublicApi = {
  async list(locale: Locale, page = 1, category?: string): Promise<PublicBlogList> {
    const params = new URLSearchParams({ locale });
    if (page > 1) params.set('page', String(page));
    if (category) params.set('category', category);
    // The page fields sit next to `data`, so read the whole body.
    const res = await fetchApi(`${BASE}?${params}`, { cache: 'no-cache' });
    const body = await res.clone().json().catch(() => null);
    const data = await handleResponse<PublicBlogCard[]>(res);
    return {
      data,
      category: body?.category ?? null,
      page: body?.page ?? page,
      pageSize: body?.pageSize ?? 12,
      total: body?.total ?? data.length,
      totalPages: body?.totalPages ?? 1,
    };
  },
  latest: (locale: Locale, limit = 3) => get<PublicBlogCard[]>(`${BASE}/latest?locale=${locale}&limit=${limit}`),
  categories: (locale: Locale) => get<PublicBlogCategory[]>(`${BASE}/categories?locale=${locale}`),
  /** Follows an old slug's 301 to the current post (its `path` then differs from the address). */
  post: (locale: Locale, slug: string) => get<PublicBlogPost>(`${BASE}/${locale}/${encodeURIComponent(slug)}`),
};
