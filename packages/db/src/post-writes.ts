import { sql, type SQL } from "drizzle-orm";
import { d1Batch, d1ErrorMessage } from "./batch";
import type { connectDb } from "./index";
import { replacePostTopics } from "./topics";

type Db = ReturnType<typeof connectDb>;
type Locale = "zh" | "en";
type TranslationInput = {
  title: string;
  slug: string;
  summary: string;
  content: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
};
type Settings = {
  coverImage?: string | null;
  categoryId?: string | null;
  tagIds?: string[];
  topicIds?: string[];
};

export async function createPost(
  db: Db,
  locale: Locale,
  translation: TranslationInput,
  settings: Settings,
) {
  const postId = crypto.randomUUID();
  const id = crypto.randomUUID();
  const now = Date.now();
  try {
    await d1Batch(db, [
      sql`INSERT INTO content_items (id, created_at_ms) VALUES (${postId}, ${now})`,
      sql`INSERT INTO posts (id, category_id, cover_image, created_at_ms, updated_at_ms)
        VALUES (${postId}, ${settings.categoryId ?? null}, ${settings.coverImage ?? null}, ${now}, ${now})`,
      insertTranslation(id, postId, locale, translation, now),
      ...replaceRelations(postId, settings),
    ]);
    return { ok: true, value: { id } } as const;
  } catch (error) {
    return saveFailure(error);
  }
}

function insertTranslation(
  id: string,
  postId: string,
  locale: Locale,
  input: TranslationInput,
  now: number,
) {
  return sql`INSERT INTO post_translations (id, post_id, locale, title, slug, summary, content,
      seo_title, seo_description, revision, published_at, first_published_at_ms, created_at_ms, updated_at_ms)
    SELECT ${id}, p.id, ${locale}, ${input.title}, ${input.slug}, ${input.summary}, ${input.content},
      ${input.seoTitle ?? null}, ${input.seoDescription ?? null}, coalesce(floor.revision, 0) + 1,
      ${now}, ${now}, ${now}, ${now}
    FROM posts p LEFT JOIN post_translation_revision_floors floor ON floor.post_id = p.id AND floor.locale = ${locale}
    WHERE p.id = ${postId} RETURNING id`;
}

export async function createPostTranslation(
  db: Db,
  postId: string,
  locale: Locale,
  input: TranslationInput,
) {
  try {
    const row = await db.get<{ id: string }>(
      insertTranslation(crypto.randomUUID(), postId, locale, input, Date.now()),
    );
    return row
      ? ({ ok: true, value: row } as const)
      : ({ ok: false, code: "POST_NOT_FOUND" } as const);
  } catch (error) {
    return saveFailure(error);
  }
}

export async function updatePostTranslation(
  db: Db,
  postId: string,
  locale: Locale,
  revision: number,
  input: TranslationInput,
) {
  const now = Date.now();
  try {
    // The slug trigger belongs to this statement. Failed CAS writes no routes;
    // a reserved route aborts the translation update as well.
    const row = await db.get<{ id: string; revision: number }>(sql`
      UPDATE post_translations SET title = ${input.title}, slug = ${input.slug},
        summary = ${input.summary}, content = ${input.content},
        seo_title = CASE WHEN ${input.seoTitle !== undefined} THEN ${input.seoTitle ?? null} ELSE seo_title END,
        seo_description = CASE WHEN ${input.seoDescription !== undefined} THEN ${input.seoDescription ?? null} ELSE seo_description END,
        first_published_at_ms = coalesce(first_published_at_ms, ${now}),
        published_at = coalesce(first_published_at_ms, ${now}),
        updated_at_ms = max(updated_at_ms, ${now}), revision = revision + 1
      WHERE post_id = ${postId} AND locale = ${locale} AND revision = ${revision}
      RETURNING id, revision`);
    return row
      ? ({ ok: true, value: row } as const)
      : ({ ok: false, code: "REVISION_CONFLICT" } as const);
  } catch (error) {
    return saveFailure(error);
  }
}

function replaceRelations(postId: string, { tagIds, topicIds }: Settings) {
  const statements: SQL[] = [];
  if (tagIds !== undefined) {
    statements.push(
      sql`DELETE FROM post_tags WHERE post_id = ${postId}`,
      sql`INSERT INTO post_tags SELECT p.id, j.value FROM posts p
        CROSS JOIN json_each(${JSON.stringify(tagIds)}) j WHERE p.id = ${postId}`,
    );
  }
  if (topicIds !== undefined)
    statements.push(...replacePostTopics(postId, topicIds));
  return statements;
}

export async function updatePostSettings(
  db: Db,
  postId: string,
  patch: Settings,
) {
  try {
    const [result] = await d1Batch(db, [
      sql`UPDATE posts SET
        category_id = CASE WHEN ${patch.categoryId !== undefined} THEN ${patch.categoryId ?? null} ELSE category_id END,
        cover_image = CASE WHEN ${patch.coverImage !== undefined} THEN ${patch.coverImage ?? null} ELSE cover_image END,
        use_shared_cover = CASE WHEN ${patch.coverImage !== undefined} THEN 1 ELSE use_shared_cover END,
        updated_at_ms = max(updated_at_ms, ${Date.now()})
        WHERE id = ${postId} RETURNING id`,
      ...replaceRelations(postId, patch),
    ]);
    return result?.results.length
      ? ({ ok: true, value: { id: postId } } as const)
      : ({ ok: false, code: "POST_NOT_FOUND" } as const);
  } catch (error) {
    return saveFailure(error);
  }
}

function saveFailure(error: unknown) {
  const message = d1ErrorMessage(error);
  if (
    /DUPLICATE_ARTICLE_SLUG|UNIQUE constraint failed: (post_routes.locale|post_translations.locale)/.test(
      message,
    )
  )
    return { ok: false, code: "DUPLICATE_SLUG" } as const;
  if (message.includes("UNIQUE constraint failed: post_translations.post_id"))
    return { ok: false, code: "DUPLICATE_LOCALE" } as const;
  if (/FOREIGN KEY constraint failed|INVALID_TOPIC_ARTICLE/.test(message))
    return { ok: false, code: "INVALID_ARTICLE_REFERENCE" } as const;
  throw error;
}

export async function deletePost(db: Db, id: string) {
  try {
    const row = await db.get<{ id: string }>(
      sql`DELETE FROM post_translations WHERE id = ${id} RETURNING id`,
    );
    return row
      ? ({ ok: true, value: row } as const)
      : ({ ok: false, code: "POST_NOT_FOUND" } as const);
  } catch (error) {
    if (d1ErrorMessage(error).includes("ARTICLE_REQUIRED_BY_SITE"))
      return { ok: false, code: "ARTICLE_REQUIRED_BY_SITE" } as const;
    throw error;
  }
}
