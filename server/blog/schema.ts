// Blog tables (docs/BLOG_SPEC.md §3). Takes the connection as a parameter so tests can use their
// own database; server/db.ts calls createBlogTables(db) from initDatabase(). No sample posts or
// categories are ever created here (CLAUDE.md rule 9).
import type { DatabaseSync } from 'node:sqlite';

export function createBlogTables(conn: DatabaseSync): void {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id TEXT PRIMARY KEY,
      locale TEXT NOT NULL,
      translation_group_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      content_json TEXT NOT NULL,
      content_html TEXT NOT NULL,
      cover_media_id TEXT,
      cover_alt TEXT,
      author_user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      published_at_ts INTEGER,
      seo_title TEXT,
      seo_description TEXT,
      tags TEXT,
      reading_minutes INTEGER NOT NULL,
      created_at_ts INTEGER NOT NULL,
      updated_at_ts INTEGER NOT NULL,
      updated_by TEXT,
      UNIQUE (locale, slug)
    );
    CREATE INDEX IF NOT EXISTS idx_blog_posts_public ON blog_posts (locale, status, published_at_ts);
    CREATE INDEX IF NOT EXISTS idx_blog_posts_group ON blog_posts (translation_group_id);
    CREATE INDEX IF NOT EXISTS idx_blog_posts_author ON blog_posts (author_user_id);

    CREATE TABLE IF NOT EXISTS blog_categories (
      id TEXT PRIMARY KEY,
      locale TEXT NOT NULL,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      translation_group_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE (locale, slug)
    );

    CREATE TABLE IF NOT EXISTS blog_post_categories (
      post_id TEXT,
      category_id TEXT,
      PRIMARY KEY (post_id, category_id)
    );
    CREATE INDEX IF NOT EXISTS idx_blog_post_categories_category ON blog_post_categories (category_id);

    -- small_*: the optional 800 px wide copy the studio uploads next to the 1600 px one (§4).
    CREATE TABLE IF NOT EXISTS blog_media (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      size_bytes INTEGER,
      alt TEXT,
      uploaded_by TEXT NOT NULL,
      created_at_ts INTEGER NOT NULL,
      small_file_name TEXT,
      small_width INTEGER,
      small_height INTEGER
    );

    -- Old slugs of published posts, answered with a 301 to the post's current slug.
    CREATE TABLE IF NOT EXISTS blog_slug_redirects (
      locale TEXT NOT NULL,
      old_slug TEXT NOT NULL,
      post_id TEXT NOT NULL,
      created_at_ts INTEGER NOT NULL,
      PRIMARY KEY (locale, old_slug)
    );
    CREATE INDEX IF NOT EXISTS idx_blog_slug_redirects_post ON blog_slug_redirects (post_id);
  `);
}
