import { sql } from "drizzle-orm";
import { d1Batch, d1ErrorMessage } from "./batch";
import type { connectDb } from "./index";

type Db = ReturnType<typeof connectDb>;
type Locale = "zh" | "en";
type TopicTranslationInput = {
  title: string;
  slug: string;
  description?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
};
type TopicSettings = { coverImage?: string | null; sortOrder?: number };
type TopicRow = {
  id: string;
  title: string;
  slug: string;
  description: string;
  sortOrder: number;
  coverImage: string | null;
  createdAt: number;
  updatedAt: number;
  articleCount: number;
  hasZh: number;
  hasEn: number;
  publicPath: string | null;
};
type Query = { search?: string; page?: number; pageSize?: number };
type AdminQuery = Query & {
  language?: "missing-en" | "bilingual";
  order?: "custom" | "updated" | "created";
};

const fields = sql`t.id, label.title, label.slug, label.description,
  t.cover_image AS coverImage, t.sort_order AS sortOrder,
  t.created_at_ms AS createdAt,
  max(t.updated_at_ms, coalesce((SELECT max(updated_at_ms) FROM topic_translations WHERE topic_id = t.id), 0)) AS updatedAt,
  (SELECT path FROM public_topics p WHERE p.managed = 1 AND p.content_id = t.id ORDER BY locale DESC LIMIT 1) AS publicPath,
  EXISTS (SELECT 1 FROM topic_translations WHERE topic_id = t.id AND locale = 'zh') AS hasZh,
  EXISTS (SELECT 1 FROM topic_translations WHERE topic_id = t.id AND locale = 'en') AS hasEn,
  (SELECT count(*) FROM topic_posts m WHERE m.topic_id = t.id) AS articleCount`;
const source = sql`FROM topics t JOIN admin_topic_labels label ON label.id = t.id`;
const date = (ms: number) => new Date(ms).toISOString();
function project({ hasZh, hasEn, ...row }: TopicRow) {
  return {
    ...row,
    locales: [
      ...(hasZh ? ["zh" as const] : []),
      ...(hasEn ? ["en" as const] : []),
    ],
    createdAt: date(row.createdAt),
    updatedAt: date(row.updatedAt),
  };
}

export async function listTopics(
  db: Db,
  {
    search = "",
    page = 1,
    pageSize = 20,
    language,
    order = "custom",
  }: AdminQuery,
) {
  const value = search.trim();
  const zh = sql`EXISTS (SELECT 1 FROM topic_translations WHERE topic_id = t.id AND locale = 'zh')`;
  const en = sql`EXISTS (SELECT 1 FROM topic_translations WHERE topic_id = t.id AND locale = 'en')`;
  const languageFilter =
    language === "missing-en"
      ? sql`NOT (${en})`
      : language === "bilingual"
        ? sql`${zh} AND ${en}`
        : sql`1`;
  const orderBy =
    order === "updated"
      ? sql`updatedAt DESC`
      : order === "created"
        ? sql`t.created_at_ms DESC`
        : sql`t.sort_order`;
  const where = sql`(${languageFilter}) AND (instr(lower(label.title), lower(${value})) > 0 OR EXISTS (
    SELECT 1 FROM topic_translations tr WHERE tr.topic_id = t.id AND instr(lower(tr.title), lower(${value})) > 0
  ) OR EXISTS (
    SELECT 1 FROM legacy_topics legacy WHERE legacy.topic_id = t.id AND instr(lower(legacy.title), lower(${value})) > 0
  ))`;
  const [rows, count] = await Promise.all([
    db.all<TopicRow>(sql`SELECT ${fields} ${source} WHERE ${where}
      ORDER BY ${orderBy}, label.slug, t.id LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`),
    db.get<{ total: number }>(
      sql`SELECT count(*) AS total ${source} WHERE ${where}`,
    ),
  ]);
  return { items: rows.map(project), total: count?.total ?? 0, page, pageSize };
}

type TopicArticle = { id: string; title: string; path: string | null };
type LegacyTopic = { title: string; slug: string; description: string };
type TopicTranslation = LegacyTopic & {
  locale: Locale;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: number;
};

export async function getTopic(db: Db, id: string) {
  const [row, articles, translations, legacy] = await Promise.all([
    db.get<TopicRow>(sql`SELECT ${fields} ${source} WHERE t.id = ${id}`),
    db.all<
      TopicArticle & { hasZh: number; hasEn: number }
    >(sql`SELECT m.post_id AS id, coalesce(a.title, m.post_id) AS title,
      CASE WHEN a.first_published_at_ms IS NOT NULL THEN a.path END AS path,
      EXISTS (SELECT 1 FROM reachable_articles r WHERE r.content_id = m.post_id AND r.locale = 'zh') AS hasZh,
      EXISTS (SELECT 1 FROM reachable_articles r WHERE r.content_id = m.post_id AND r.locale = 'en') AS hasEn
      FROM topic_posts m
      LEFT JOIN current_articles a ON a.translation_id = (SELECT tr.translation_id FROM current_articles tr
        WHERE tr.content_id = m.post_id ORDER BY tr.first_published_at_ms IS NULL, tr.locale DESC LIMIT 1)
      WHERE m.topic_id = ${id} ORDER BY m.sort_order`),
    db.all<TopicTranslation>(sql`SELECT locale, title, slug, description, seo_title AS seoTitle,
      seo_description AS seoDescription, published_at AS publishedAt FROM topic_translations WHERE topic_id = ${id}`),
    db.get<LegacyTopic>(
      sql`SELECT title, slug, description FROM legacy_topics WHERE topic_id = ${id}`,
    ),
  ]);
  return row
    ? {
        ...project(row),
        articles: articles.map(({ hasZh, hasEn, ...article }) => ({
          ...article,
          locales: [
            ...(hasZh ? ["zh" as const] : []),
            ...(hasEn ? ["en" as const] : []),
          ],
        })),
        legacy: legacy ?? null,
        translations: translations.map((tr) => ({
          ...tr,
          publishedAt: date(tr.publishedAt),
        })),
      }
    : undefined;
}

function translationValues(input: TopicTranslationInput) {
  return sql`${input.title}, ${input.slug}, ${input.description ?? ""}, ${input.seoTitle ?? null}, ${input.seoDescription ?? null}`;
}
const translationColumns = sql`topic_id, locale, title, slug, description, seo_title, seo_description, published_at, updated_at_ms`;

function translationConflict(error: unknown) {
  const message = d1ErrorMessage(error);
  if (
    /DUPLICATE_TOPIC_SLUG|topic_translations.locale, topic_translations.slug/.test(
      message,
    )
  )
    return { ok: false, code: "DUPLICATE_TOPIC_SLUG" } as const;
  if (
    message.includes("topic_translations.topic_id, topic_translations.locale")
  )
    return { ok: false, code: "TOPIC_TRANSLATION_EXISTS" } as const;
  throw error;
}

export async function createTopic(
  db: Db,
  input: TopicTranslationInput & TopicSettings & { locale: Locale },
) {
  const id = crypto.randomUUID();
  const now = Date.now();
  try {
    await d1Batch(db, [
      sql`INSERT INTO topics (id, cover_image, sort_order, created_at_ms, updated_at_ms)
        VALUES (${id}, ${input.coverImage ?? null}, ${input.sortOrder ?? 0}, ${now}, ${now})`,
      sql`INSERT INTO topic_translations (${translationColumns})
        VALUES (${id}, ${input.locale}, ${translationValues(input)}, ${now}, ${now})`,
    ]);
    return { ok: true, value: { id } } as const;
  } catch (error) {
    return translationConflict(error);
  }
}

export async function saveTopicTranslation(
  db: Db,
  id: string,
  locale: Locale,
  input: TopicTranslationInput,
  create: boolean,
) {
  const now = Date.now();
  try {
    const row = create
      ? await db.get<{
          id: string;
        }>(sql`INSERT INTO topic_translations (${translationColumns})
          SELECT id, ${locale}, ${translationValues(input)}, ${now}, ${now} FROM topics WHERE id = ${id}
          RETURNING topic_id AS id`)
      : await db.get<{ id: string }>(sql`UPDATE topic_translations
          SET (title, slug, description, seo_title, seo_description) = (${translationValues(input)}),
              updated_at_ms = max(updated_at_ms, ${now})
          WHERE topic_id = ${id} AND locale = ${locale} RETURNING topic_id AS id`);
    return row
      ? ({ ok: true, value: row } as const)
      : ({
          ok: false,
          code: create ? "TOPIC_NOT_FOUND" : "TOPIC_TRANSLATION_NOT_FOUND",
        } as const);
  } catch (error) {
    return translationConflict(error);
  }
}

export function updateTopicSettings(
  db: Db,
  id: string,
  { coverImage, sortOrder }: TopicSettings,
) {
  return db.get<{ id: string }>(sql`UPDATE topics SET
    cover_image = CASE WHEN ${coverImage !== undefined} THEN ${coverImage ?? null} ELSE cover_image END,
    sort_order = coalesce(${sortOrder ?? null}, sort_order), updated_at_ms = max(updated_at_ms, ${Date.now()})
    WHERE id = ${id} RETURNING id`);
}

export function deleteTopic(db: Db, id: string) {
  return db.get<{ id: string }>(
    sql`DELETE FROM topics WHERE id = ${id} RETURNING id`,
  );
}

export async function replaceTopicPosts(db: Db, id: string, ids: string[]) {
  if (new Set(ids).size !== ids.length)
    return { ok: false, code: "DUPLICATE_TOPIC_ARTICLE" } as const;
  try {
    const order = JSON.stringify(ids);
    const [updated] = await d1Batch(db, [
      sql`UPDATE topics SET updated_at_ms = max(updated_at_ms, ${Date.now()}) WHERE id = ${id} RETURNING id`,
      sql`DELETE FROM topic_posts WHERE topic_id = ${id} AND post_id NOT IN (SELECT value FROM json_each(${order}))`,
      // Vacate positions first so swapping two members does not hit the unique index.
      // Keep existing rows, including members with no currently published version.
      sql`UPDATE topic_posts SET sort_order = sort_order + (
        SELECT max(sort_order) FROM topic_posts WHERE topic_id = ${id}
      ) + ${ids.length + 1} WHERE topic_id = ${id}`,
      sql`UPDATE topic_posts SET sort_order = (
        SELECT key FROM json_each(${order}) WHERE value = post_id
      ) WHERE topic_id = ${id}`,
      sql`INSERT INTO topic_posts (topic_id, post_id, sort_order)
        SELECT t.id, j.value, j.key FROM topics t CROSS JOIN json_each(${order}) j WHERE t.id = ${id}
        AND NOT EXISTS (SELECT 1 FROM topic_posts m WHERE m.topic_id = t.id AND m.post_id = j.value)`,
    ]);
    return updated?.results.length
      ? ({ ok: true, value: { id } } as const)
      : ({ ok: false, code: "TOPIC_NOT_FOUND" } as const);
  } catch (error) {
    if (d1ErrorMessage(error).includes("INVALID_TOPIC_ARTICLE"))
      return { ok: false, code: "INVALID_TOPIC_ARTICLE" } as const;
    throw error;
  }
}

export function replacePostTopics(postId: string, ids: string[]) {
  const selected = JSON.stringify(ids);
  return [
    sql`DELETE FROM topic_posts WHERE post_id = ${postId} AND topic_id NOT IN (SELECT value FROM json_each(${selected}))`,
    sql`INSERT INTO topic_posts (topic_id, post_id, sort_order)
      SELECT j.value, ${postId}, coalesce((SELECT max(m.sort_order) FROM topic_posts m WHERE m.topic_id = j.value), -1) + 1
      FROM posts p CROSS JOIN json_each(${selected}) j WHERE p.id = ${postId} AND NOT EXISTS (
        SELECT 1 FROM topic_posts m WHERE m.post_id = ${postId} AND m.topic_id = j.value
      )`,
  ];
}

type PublicTopicRow = {
  slug: string;
  title: string;
  description: string;
  coverImage: string | null;
  path: string;
  updatedAt: number;
};
const publicFields = sql`slug, title, summary AS description, cover_image AS coverImage, path, modified_at_ms AS updatedAt`;
const projectPublic = (row: PublicTopicRow) => ({
  ...row,
  updatedAt: date(row.updatedAt),
});

export async function listPublicTopics(
  db: Db,
  locale: Locale,
  { search = "", page = 1, pageSize = 20 }: Query,
) {
  const where = sql`locale = ${locale} AND instr(lower(title), lower(${search.trim()})) > 0`;
  const [rows, count] = await Promise.all([
    db.all<PublicTopicRow>(sql`SELECT ${publicFields} FROM public_topics WHERE ${where}
      ORDER BY sort_order, path LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`),
    db.get<{ total: number }>(
      sql`SELECT count(*) AS total FROM public_topics WHERE ${where}`,
    ),
  ]);
  return {
    items: rows.map(projectPublic),
    total: count?.total ?? 0,
    page,
    pageSize,
  };
}

export async function getPublicTopic(db: Db, locale: Locale, slug: string) {
  const row = await db.get<
    PublicTopicRow & { content_id: string; managed: number }
  >(sql`
    SELECT ${publicFields}, content_id, managed FROM public_topics t WHERE t.locale = ${locale}
    AND EXISTS (SELECT 1 FROM public_topic_routes r
      WHERE r.locale = t.locale AND r.topic_id = t.content_id AND r.managed = t.managed AND r.slug = ${slug})`);
  if (!row) return undefined;
  const { content_id, managed, ...topic } = row;
  const articles = await db.all<{
    title: string;
    path: string;
    summary: string;
  }>(sql`
    SELECT title, path, summary FROM public_topic_members
    WHERE topic_id = ${content_id} AND locale = ${locale} AND managed = ${managed} ORDER BY position`);
  return { ...projectPublic(topic), articles };
}
