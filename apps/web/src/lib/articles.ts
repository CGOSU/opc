import type { D1Database } from "@cloudflare/workers-types/index.ts";
import type { Locale } from "./home";

export type ArticleSummary = {
  path: string;
  title: string;
  summary: string;
  content_id: string;
  first_published_at_ms: number;
};

type Article = ArticleSummary & {
  body_markdown: string;
  modified_at_ms: number;
  seo_title: string | null;
  seo_description: string | null;
  cover_key: string | null;
  cover_alt: string | null;
  source_author: string | null;
  noindex: 0 | 1;
  alternate_path: string | null;
  alternate_noindex: 0 | 1 | null;
};

export function articleLocale(value: string | undefined): Locale | undefined {
  return value === "zh" || value === "en" ? value : undefined;
}

export function articlesPath(locale: Locale) {
  return `/${locale}/articles/`;
}

export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Callers supply fixed SQL aliases and namespaces, never request inputs.
// Apply this before LIMIT so invalid routes cannot crowd out reachable pages.
export function publicSlugRoute(
  column: string,
  namespace: "articles" | "topics",
) {
  const slug = `substr(${column}, ${namespace.length + 3}, length(${column}) - ${namespace.length + 3})`;
  return `(${column} GLOB '/${namespace}/*/'
    AND ${slug} GLOB '[a-z0-9]*'
    AND ${slug} NOT GLOB '*[^a-z0-9-]*'
    AND ${slug} NOT GLOB '*--*'
    AND ${slug} NOT GLOB '*-')`;
}

export function isArticlePath(path: string, locale: Locale) {
  const base = articlesPath(locale);
  return (
    path.startsWith(base) &&
    path.endsWith("/") &&
    slugPattern.test(path.slice(base.length, -1))
  );
}

export async function listArticles(db: D1Database, locale: Locale, limit = -1) {
  const { results } = await db
    .prepare(
      `
      SELECT path, title, summary, content_id, first_published_at_ms
      FROM published_articles
      WHERE locale = ? AND ${publicSlugRoute("route_path", "articles")}
      ORDER BY first_published_at_ms DESC, path
      LIMIT ?
    `,
    )
    .bind(locale, limit)
    .all<ArticleSummary>();
  return results;
}

export async function searchArticles(
  db: D1Database,
  locale: Locale,
  query: string,
) {
  const pattern = "%" + query.replace(/[!%_]/g, "!$&") + "%";
  const { results } = await db
    .prepare(
      `
      SELECT path, title, summary, content_id, first_published_at_ms
      FROM published_articles
      WHERE locale = ? AND ${publicSlugRoute("route_path", "articles")}
        AND (title LIKE ? ESCAPE '!' OR summary LIKE ? ESCAPE '!')
      ORDER BY first_published_at_ms DESC, path
      LIMIT 21
    `,
    )
    .bind(locale, pattern, pattern)
    .all<ArticleSummary>();
  return results;
}

export async function nearbyArticles(
  db: D1Database,
  locale: Locale,
  article: ArticleSummary,
) {
  const [newer, older] = await db.batch<ArticleSummary>(
    ([true, false] as const).map((previous) =>
      db
        .prepare(
          `
        SELECT path, title, summary, content_id, first_published_at_ms
        FROM published_articles
        WHERE locale = ? AND ${publicSlugRoute("route_path", "articles")}
          AND (first_published_at_ms ${previous ? ">" : "<"} ?
            OR (first_published_at_ms = ? AND path ${previous ? "<" : ">"} ?))
        ORDER BY first_published_at_ms ${previous ? "ASC" : "DESC"}, path ${previous ? "DESC" : "ASC"}
        LIMIT 2
      `,
        )
        .bind(
          locale,
          article.first_published_at_ms,
          article.first_published_at_ms,
          article.path,
        ),
    ),
  );
  return {
    previous: newer.results[0],
    next: older.results[0],
    related: [...older.results, ...newer.results].slice(0, 3),
  };
}

export async function findArticle(
  db: D1Database,
  locale: Locale,
  slug: string | undefined,
) {
  if (!slug || !slugPattern.test(slug)) return null;
  const article = await db
    .prepare(
      `
    SELECT a.path, a.content_id, a.title, a.summary, a.body_markdown, a.first_published_at_ms,
           a.modified_at_ms, a.seo_title, a.seo_description, a.cover_key, a.cover_alt,
           a.source_author, a.noindex, alt.path AS alternate_path,
           alt.noindex AS alternate_noindex
    FROM content_routes AS requested
    JOIN published_articles AS a ON a.translation_id = requested.translation_id
    LEFT JOIN published_articles AS alt
      ON alt.content_id = a.content_id AND alt.locale = ?
    WHERE requested.locale = ? AND requested.route_path = ?
  `,
    )
    .bind(locale === "zh" ? "en" : "zh", locale, `/articles/${slug}/`)
    .first<Article>();
  return article && isArticlePath(article.path, locale) ? article : null;
}

export function articleAlternate(article: Article, locale: Locale) {
  const other: Locale = locale === "zh" ? "en" : "zh";
  const path = article.alternate_path;
  if (!path || !isArticlePath(path, other)) return undefined;
  return { locale: other, path, noindex: article.alternate_noindex === 1 };
}

export function articleCover(base: string | undefined, key: string | null) {
  if (!base || !key) return undefined;
  const directory = URL.parse(base);
  if (
    !directory ||
    !["http:", "https:"].includes(directory.protocol) ||
    directory.username ||
    directory.password ||
    directory.search ||
    directory.hash
  )
    return undefined;
  const segments = key.split("/");
  if (segments.some((part) => !part || part === "." || part === ".."))
    return undefined;
  return new URL(
    `${directory.href.replace(/\/$/, "")}/${segments.map(encodeURIComponent).join("/")}`,
  );
}

export function articleDate(ms: number, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(ms);
}

export function articleUnavailable() {
  console.error("Public content data unavailable.");
  return new Response("Service unavailable", {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
