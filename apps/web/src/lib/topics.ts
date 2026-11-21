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
  cover_image: string | null;
  managed: 0 | 1;
};

type TopicMember = Pick<Topic, "content_id" | "path" | "title" | "summary">;

export function topicsPath(locale: Locale) {
  return `/${locale}/topics/`;
}

export async function listTopics(db: D1Database, locale: Locale, limit = -1) {
  const { results } = await db
    .prepare(
      `
    SELECT content_id, path, title, summary FROM public_topics
    WHERE locale = ? ORDER BY sort_order, path LIMIT ?
  `,
    )
    .bind(locale, limit)
    .all<TopicMember>();
  return results;
}

export async function listTopicDiscovery(db: D1Database) {
  const { results } = await db
    .prepare(
      `
    SELECT locale, path, modified_at_ms, noindex FROM public_topics
    WHERE locale IN ('zh', 'en') ORDER BY path
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
    FROM public_topics t
    LEFT JOIN public_topics alt ON alt.content_id = t.content_id AND alt.managed = t.managed
      AND alt.locale = CASE t.locale WHEN 'zh' THEN 'en' ELSE 'zh' END
    WHERE t.locale = ? AND EXISTS (
      SELECT 1 FROM public_topic_routes r
      WHERE r.locale = t.locale AND r.topic_id = t.content_id AND r.managed = t.managed AND r.slug = ?
    )
  `,
    )
    .bind(locale, slug)
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
  topic: Pick<Topic, "content_id" | "managed">,
) {
  const { results } = await db
    .prepare(
      `
    SELECT post_id AS content_id, path, title, summary FROM public_topic_members
    WHERE topic_id = ? AND locale = ? AND managed = ? ORDER BY position
  `,
    )
    .bind(topic.content_id, locale, topic.managed)
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
    SELECT t.content_id, t.path, t.title, t.managed
    FROM public_topic_members m JOIN public_topics t
      ON t.content_id = m.topic_id AND t.locale = m.locale AND t.managed = m.managed
    WHERE m.locale = ? AND m.post_id = ?
    ORDER BY m.is_featured DESC, m.managed, t.sort_order, t.path LIMIT 1
  `,
    )
    .bind(locale, contentId)
    .first<Pick<Topic, "content_id" | "path" | "title" | "managed">>();
}

export async function articleTopics(
  db: D1Database,
  locale: Locale,
  ids: string[],
) {
  if (!ids.length) return new Map<string, { path: string; title: string }>();
  const { results } = await db
    .prepare(
      `
    SELECT post_id, path, title FROM (
      SELECT m.post_id, t.path, t.title, row_number() OVER (
        PARTITION BY m.post_id ORDER BY m.is_featured DESC, m.managed, t.sort_order, t.path
      ) AS rank
      FROM public_topic_members m JOIN public_topics t
        ON t.content_id = m.topic_id AND t.locale = m.locale AND t.managed = m.managed
      WHERE m.locale = ? AND m.post_id IN (SELECT value FROM json_each(?))
    ) WHERE rank = 1
  `,
    )
    .bind(locale, JSON.stringify(ids))
    .all<{ post_id: string; path: string; title: string }>();
  return new Map(
    results.map(({ post_id, path, title }) => [post_id, { path, title }]),
  );
}

export async function featuredPractice(
  db: D1Database,
  locale: Locale,
  latest: string[],
) {
  const { results } = await db
    .prepare(
      `
    SELECT a.path, a.title, a.summary, a.content_id, a.first_published_at_ms
    FROM published_articles AS a
    WHERE a.locale = ? AND ${publicSlugRoute("a.route_path", "articles")}
      AND a.content_id NOT IN (SELECT value FROM json_each(?))
      AND EXISTS (SELECT 1 FROM public_topic_members m
        WHERE m.post_id = a.content_id AND m.is_featured = 1 AND m.locale = a.locale)
    ORDER BY a.first_published_at_ms DESC, a.path LIMIT 3
  `,
    )
    .bind(locale, JSON.stringify(latest))
    .all<ArticleSummary>();
  return results;
}
