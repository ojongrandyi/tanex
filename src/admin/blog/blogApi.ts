// Blog studio API client (server/routes/blog.ts, docs/BLOG_SPEC.md §4–§5). Console-only: imported
// from the lazy Blog studio chunk and My account, never from public pages.
import { fetchApi, handleResponse, type SessionUser } from '../../services/api';
import type { CompressedImage } from '../../services/imageCompress';

const BASE = '/api/admin/blog';

export type BlogLocale = 'en' | 'fr';
export type PostStatus = 'DRAFT' | 'IN_REVIEW' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
export const POST_STATUSES: readonly PostStatus[] = ['DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'];

/** A TipTap/ProseMirror JSON node. */
export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

export interface BlogCover { url: string; width: number | null; height: number | null; alt: string }

export interface BlogPostSummary {
  id: string;
  locale: BlogLocale;
  translationGroupId: string;
  slug: string;
  title: string;
  excerpt: string;
  status: PostStatus;
  isPublic: boolean;
  publicPath: string;
  publishedAt: number | null;
  cover: BlogCover | null;
  coverMediaId: string | null;
  coverAlt: string;
  author: { id: string; name: string | null };
  categories: { id: string; slug: string; name: string }[];
  tags: string[];
  readingMinutes: number;
  translations: { id: string; locale: BlogLocale; slug: string; title: string; status: PostStatus }[];
  createdAt: number;
  updatedAt: number;
  updatedBy: string | null;
}

export interface BlogPost extends BlogPostSummary {
  content: DocNode;
  contentHtml: string;
  seoTitle: string;
  seoDescription: string;
}

export interface PostPage {
  data: BlogPostSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface BlogCategory {
  id: string;
  locale: BlogLocale;
  slug: string;
  name: string;
  description: string;
  translationGroupId: string;
  sortOrder: number;
  postCount?: number;
}

export interface BlogMedia {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  alt: string;
  small: { url: string; width: number | null; height: number | null } | null;
  uploadedBy: string;
  createdAt: number;
}

export interface PostInput {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: DocNode;
  coverMediaId?: string | null;
  coverAlt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  tags?: string[];
  categoryIds?: string[];
  authorUserId?: string;
  expectedUpdatedAt?: number;
}

export interface PreviewPost {
  locale: BlogLocale;
  slug: string;
  path: string;
  title: string;
  excerpt: string;
  cover: BlogCover | null;
  publishedAt: number | null;
  readingMinutes: number;
  categories: { slug: string; name: string }[];
  status: PostStatus;
  isPublic: boolean;
  contentHtml: string;
  updatedAt: number;
  author: { name: string; jobTitle: string; avatarUrl: string | null };
  tags: string[];
}

function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: method === 'GET' ? 'no-store' : undefined
  };
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  return handleResponse<T>(await fetchApi(path, init));
}

export const blogApi = {
  async listPosts(q: { status?: PostStatus; locale?: BlogLocale; q?: string; mine?: boolean; page?: number }): Promise<PostPage> {
    const params = new URLSearchParams();
    if (q.status) params.set('status', q.status);
    if (q.locale) params.set('locale', q.locale);
    if (q.q) params.set('q', q.q);
    if (q.mine) params.set('mine', '1');
    if (q.page && q.page > 1) params.set('page', String(q.page));
    // The list route answers with the page fields next to `data`, so read the whole body.
    const res = await fetchApi(`${BASE}/posts?${params}`, json('GET'));
    const body = await res.clone().json().catch(() => null);
    const data = await handleResponse<BlogPostSummary[]>(res);
    return { data, page: body?.page ?? 1, pageSize: body?.pageSize ?? 50, total: body?.total ?? data.length, totalPages: body?.totalPages ?? 1 };
  },
  getPost: (id: string) => call<BlogPost>(`${BASE}/posts/${encodeURIComponent(id)}`, json('GET')),
  createPost: (input: PostInput & { locale?: BlogLocale; translationOf?: string }) => call<BlogPost>(`${BASE}/posts`, json('POST', input)),
  updatePost: (id: string, input: PostInput) => call<BlogPost>(`${BASE}/posts/${encodeURIComponent(id)}`, json('PUT', input)),
  deletePost: (id: string) => call<unknown>(`${BASE}/posts/${encodeURIComponent(id)}`, json('DELETE')),
  submit: (id: string) => call<BlogPost>(`${BASE}/posts/${encodeURIComponent(id)}/submit`, json('POST', {})),
  publish: (id: string, publishAt?: number) =>
    call<BlogPost>(`${BASE}/posts/${encodeURIComponent(id)}/publish`, json('POST', publishAt ? { publishAt } : {})),
  unpublish: (id: string) => call<BlogPost>(`${BASE}/posts/${encodeURIComponent(id)}/unpublish`, json('POST', {})),
  archive: (id: string) => call<BlogPost>(`${BASE}/posts/${encodeURIComponent(id)}/archive`, json('POST', {})),
  previewToken: (id: string) => call<{ token: string; expiresAt: number }>(`${BASE}/posts/${encodeURIComponent(id)}/preview`, json('POST', {})),
  authors: () => call<{ id: string; name: string; jobTitle: string }[]>(`${BASE}/authors`, json('GET')),

  listCategories: (locale?: BlogLocale) => call<BlogCategory[]>(`${BASE}/categories${locale ? `?locale=${locale}` : ''}`, json('GET')),
  createCategory: (input: { locale: BlogLocale; name: string; slug?: string; description?: string; sortOrder?: number; translationOf?: string }) =>
    call<BlogCategory>(`${BASE}/categories`, json('POST', input)),
  updateCategory: (id: string, input: { name?: string; slug?: string; description?: string; sortOrder?: number }) =>
    call<BlogCategory>(`${BASE}/categories/${encodeURIComponent(id)}`, json('PUT', input)),
  deleteCategory: (id: string) => call<unknown>(`${BASE}/categories/${encodeURIComponent(id)}`, json('DELETE')),

  listMedia: () => call<BlogMedia[]>(`${BASE}/media`, json('GET')),
  /** Uploads the 1600 px file, then its 800 px copy when it is narrower (BLOG_SPEC §4). */
  async uploadMedia(large: CompressedImage, small: CompressedImage | null, alt?: string): Promise<BlogMedia> {
    let media = await call<BlogMedia>(`${BASE}/media`, json('POST', { image: large.base64, alt }));
    if (small && media.width && small.width < media.width) {
      media = await call<BlogMedia>(`${BASE}/media/${encodeURIComponent(media.id)}/small`, json('PUT', { image: small.base64 }));
    }
    return media;
  },
  deleteMedia: (id: string) => call<unknown>(`${BASE}/media/${encodeURIComponent(id)}`, json('DELETE')),

  /** Public preview route (token only, no session). */
  getPreview: (token: string) => call<PreviewPost>(`/api/blog/preview/${encodeURIComponent(token)}`, { cache: 'no-store' })
};

/** My account: own profile photo (POST/DELETE /api/auth/me/avatar). */
export const profileApi = {
  async uploadAvatar(image: CompressedImage): Promise<SessionUser | null> {
    const res = await fetchApi('/api/auth/me/avatar', json('POST', { image: image.base64 }));
    return (await handleResponse<{ user?: SessionUser }>(res))?.user ?? null;
  },
  async removeAvatar(): Promise<SessionUser | null> {
    const res = await fetchApi('/api/auth/me/avatar', json('DELETE'));
    return (await handleResponse<{ user?: SessionUser }>(res))?.user ?? null;
  }
};
