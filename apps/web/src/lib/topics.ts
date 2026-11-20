import type { D1Database } from "@cloudflare/workers-types/index.ts";
import type { Locale } from "./home";
import { publicSlugRoute, slugPattern, type ArticleSummary } from "./articles";

export type Topic = {
  content_id: string;
  path: string;
  title: string;
  summary: string;
  body_markdown: string;
  seo_title: string | null;
  seo_description: string | null;
  noindex: 0 | 1;
  modified_at_ms: number;
};

type TopicMember = {
  content_id: string;
  path: string;
  title: string;
  summary: string;
};

const availableTopics = `
  SELECT p.content_id, p.path, p.title, p.summary, p.body_markdown,
         p.seo_title, p.seo_description, p.noindex, p.modified_at_ms,
         p.locale, p.revision_id
  FROM published_content AS p
  WHERE p.kind = 'collection'
    AND ${publicSlugRoute("p.route_path", "topics")}
    AND (trim(p.summary) <> '' OR trim(p.body_markdown) <> '')
    AND EXISTS (
      SELECT 1 FROM collection_members AS m
      JOIN published_articles AS a
        ON a.content_id = m.member_content_id AND a.locale = p.locale
      WHERE m.collection_revision_id = p.revision_id
        AND ${publicSlugRoute("a.route_path", "articles")}
    )
`;

export function topicsPath(locale: Locale) {
  return `/${locale}/topics/`;
}

export async function listTopics(db: D1Database, locale: Locale, limit = -1) {
  const { results } = await db
    .prepare(
      `
    SELECT content_id, path, title, summary
    FROM (${availableTopics})
    WHERE locale = ?
    ORDER BY path
    LIMIT ?
  `,
    )
    .bind(locale, limit)
    .all<Pick<Topic, "content_id" | "path" | "title" | "summary">>();
  return results;
}

export async function listTopicDiscovery(db: D1Database) {
  const { results } = await db
    .prepare(
      `
      SELECT locale, path, modified_at_ms, noindex
      FROM (${availableTopics})
      WHERE locale IN ('zh', 'en')
      ORDER BY path
    `,
    )
    .all<
      Pick<Topic, "path" | "modified_at_ms" | "noindex"> & { locale: Locale }
    >();
  return results;
}

export async function findTopic(
  db: D1Database,
  locale: Locale,
  slug: string | undefined,
) {
  if (!slug || !slugPattern.test(slug)) return null;
  return db
    .prepare(
      `
    SELECT t.*, alt.path AS alternate_path, alt.noindex AS alternate_noindex
    FROM content_routes AS requested
    JOIN (${availableTopics}) AS t ON t.locale = requested.locale
      AND t.content_id = (SELECT content_id FROM content_translations WHERE id = requested.translation_id)
    LEFT JOIN (${availableTopics}) AS alt ON alt.content_id = t.content_id AND alt.locale <> t.locale
    WHERE requested.locale = ? AND requested.route_path = ?
  `,
    )
    .bind(locale, `/topics/${slug}/`)
    .first<
      Topic & {
        alternate_path: string | null;
        alternate_noindex: 0 | 1 | null;
      }
    >();
}

export async function topicMembers(
  db: D1Database,
  locale: Locale,
  contentId: string,
) {
  const { results } = await db
    .prepare(
      `
    SELECT member_content_id AS content_id, member_path AS path,
           member_title AS title, member_summary AS summary
    FROM published_collection_members
    WHERE collection_content_id = ? AND locale = ?
      AND ${publicSlugRoute("substr(member_path, 4)", "articles")}
    ORDER BY position
  `,
    )
    .bind(contentId, locale)
    .all<TopicMember>();
  return results;
}

export async function articleTopic(
  db: D1Database,
  locale: Locale,
  contentId: string,
) {
  return db
    .prepare(
      `
    SELECT t.content_id, t.path, t.title
    FROM (${availableTopics}) AS t
    JOIN collection_members AS m
      ON m.collection_revision_id = t.revision_id AND m.member_content_id = ?
    WHERE t.locale = ?
    ORDER BY m.is_featured DESC, t.path
    LIMIT 1
  `,
    )
    .bind(contentId, locale)
    .first<Pick<Topic, "content_id" | "path" | "title">>();
}

export async function articleTopics(
  db: D1Database,
  locale: Locale,
  ids: string[],
) {
  if (!ids.length) return new Map<string, { path: string; title: string }>();
  const placeholders = ids.map(() => "?").join(", ");
  const { results } = await db
    .prepare(
      `
    SELECT member_content_id, path, title FROM (
      SELECT m.member_content_id, t.path, t.title,
             row_number() OVER (
               PARTITION BY m.member_content_id ORDER BY m.is_featured DESC, t.path
             ) AS rank
      FROM collection_members AS m
      JOIN (${availableTopics}) AS t ON t.revision_id = m.collection_revision_id
      WHERE t.locale = ? AND m.member_content_id IN (${placeholders})
    )
    WHERE rank = 1
  `,
    )
    .bind(locale, ...ids)
    .all<{ member_content_id: string; path: string; title: string }>();
  return new Map(
    results.map(({ member_content_id, path, title }) => [
      member_content_id,
      { path, title },
    ]),
  );
}

export async function featuredPractice(
  db: D1Database,
  locale: Locale,
  latest: string[],
) {
  const excluded = latest.map(() => "?").join(", ");
  const { results } = await db
    .prepare(
      `
    SELECT a.path, a.title, a.summary, a.content_id, a.first_published_at_ms
    FROM published_articles AS a
    WHERE a.locale = ? AND ${publicSlugRoute("a.route_path", "articles")}
      ${excluded ? `AND a.content_id NOT IN (${excluded})` : ""}
      AND EXISTS (
        SELECT 1 FROM collection_members AS m
        JOIN (${availableTopics}) AS t ON t.revision_id = m.collection_revision_id
        WHERE m.member_content_id = a.content_id AND m.is_featured = 1 AND t.locale = a.locale
      )
    ORDER BY a.first_published_at_ms DESC, a.path
    LIMIT 3
  `,
    )
    .bind(locale, ...latest)
    .all<ArticleSummary>();
  return results;
}
