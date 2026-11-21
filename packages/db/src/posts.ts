import { sql, type SQL } from "drizzle-orm";
import type { connectDb } from "./index";

export {
  createPost,
  createPostTranslation,
  updatePostTranslation,
  updatePostSettings,
  deletePost,
} from "./post-writes";

type Db = ReturnType<typeof connectDb>;
type Locale = "zh" | "en";
type ListQuery = {
  locale?: Locale;
  search?: string;
  categoryId?: string;
  tagId?: string;
  topicId?: string;
  term?: { kind: "categories" | "tags"; slug: string };
  sort?: "updated" | "created";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

type PostRow = {
  id: string;
  contentId: string;
  locale: Locale;
  title: string;
  path: string | null;
  slug: string | null;
  summary: string;
  coverImage: string | null;
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
  categoryId: string | null;
  category: string | null;
  labels: string;
  versions: string;
  topicLabels: string;
};

type PostDetailRow = PostRow & {
  content: string;
  revision: number;
  seoTitle: string | null;
  seoDescription: string | null;
  sharedCoverImage: string | null;
  usesLegacyCover: number;
};

// Use the same publication view as Astro, not a second copy of the article data.
function fields(admin = false) {
  const tagJoin = admin
    ? sql`LEFT JOIN localized_tags tag ON tag.id = pt.tag_id AND tag.locale = p.locale`
    : sql`JOIN localized_tags tag ON tag.id = pt.tag_id AND tag.locale = p.locale`;
  const tagName = admin
    ? sql`coalesce(tag.name, (SELECT name FROM localized_tags lt WHERE lt.id = pt.tag_id ORDER BY locale = 'zh' DESC LIMIT 1))`
    : sql`tag.name`;
  const categoryId = admin ? sql`posts.category_id` : sql`cat.id`;
  const categoryName = admin
    ? sql`coalesce(cat.name, (SELECT name FROM localized_categories lc WHERE lc.id = posts.category_id ORDER BY locale = 'zh' DESC LIMIT 1))`
    : sql`cat.name`;
  return sql`p.translation_id AS id, p.content_id AS contentId, p.locale,
  p.title, p.path, coalesce(tr.slug, substr(p.route_path, 11, length(p.route_path) - 11)) AS slug,
  p.summary, p.cover_url AS coverImage, tr.created_at_ms AS createdAt,
  p.modified_at_ms AS updatedAt, p.first_published_at_ms AS publishedAt,
  ${categoryId} AS categoryId, ${categoryName} AS category,
  (SELECT json_group_array(json_object('id', pt.tag_id, 'name', ${tagName}))
    FROM post_tags pt ${tagJoin} WHERE pt.post_id = p.content_id) AS labels,
  (SELECT json_group_array(json_object('id', alt.id, 'locale', alt.locale))
    FROM post_translations alt WHERE alt.post_id = p.content_id) AS versions,
  (SELECT json_group_array(json_object('id', topic.id, 'title', topic.title))
    FROM topic_posts tp JOIN admin_topic_labels topic ON topic.id = tp.topic_id WHERE tp.post_id = p.content_id) AS topicLabels`;
}
const joins = sql`JOIN post_translations tr ON tr.id = p.translation_id
  JOIN posts ON posts.id = p.content_id
  LEFT JOIN localized_categories cat ON cat.id = posts.category_id AND cat.locale = p.locale`;
const source = sql`FROM published_articles p ${joins}`;

function project<T extends PostRow>({
  labels,
  versions,
  topicLabels,
  createdAt,
  updatedAt,
  publishedAt,
  ...row
}: T) {
  const tags: { id: string; name: string }[] = JSON.parse(labels);
  const translations: { id: string; locale: Locale }[] = JSON.parse(versions);
  const topics: { id: string; title: string }[] = JSON.parse(topicLabels);
  return {
    ...row,
    tags,
    topics,
    translations,
    createdAt: new Date(createdAt).toISOString(),
    updatedAt: new Date(updatedAt).toISOString(),
    publishedAt:
      publishedAt === null ? null : new Date(publishedAt).toISOString(),
  };
}

export async function listPosts(db: Db, query: ListQuery, admin = false) {
  const { locale, categoryId, tagId, page = 1, pageSize = 20 } = query;
  const filters: SQL[] = [sql`p.route_path GLOB '/articles/*/'`];
  const search = query.search?.trim();
  if (search)
    filters.push(
      sql`p.title LIKE ${`%${search.replace(/[!%_]/g, "!$&")}%`} ESCAPE '!'`,
    );
  if (locale) filters.push(sql`p.locale = ${locale}`);
  if (categoryId) filters.push(sql`posts.category_id = ${categoryId}`);
  if (tagId)
    filters.push(
      sql`EXISTS (SELECT 1 FROM post_tags pt WHERE pt.post_id = p.content_id AND pt.tag_id = ${tagId})`,
    );
  if (query.topicId)
    filters.push(
      sql`EXISTS (SELECT 1 FROM topic_posts tp WHERE tp.post_id = p.content_id AND tp.topic_id = ${query.topicId})`,
    );
  if (query.term?.kind === "categories")
    filters.push(sql`EXISTS (SELECT 1 FROM category_routes r WHERE r.id = posts.category_id
      AND r.locale = p.locale AND r.slug = ${query.term.slug})`);
  if (query.term?.kind === "tags")
    filters.push(sql`EXISTS (SELECT 1 FROM post_tags pt JOIN tag_routes tag ON tag.id = pt.tag_id
    WHERE pt.post_id = p.content_id AND tag.locale = p.locale AND tag.slug = ${query.term.slug})`);
  const where = sql.join(filters, sql` AND `);
  const sort =
    query.sort === "created" ? sql`tr.created_at_ms` : sql`p.modified_at_ms`;
  const direction = query.order === "asc" ? sql`ASC` : sql`DESC`;
  const [rows, counts] = await Promise.all([
    db.all<PostRow>(sql`SELECT ${fields(admin)} ${source} WHERE ${where}
      ORDER BY ${sort} ${direction}, p.translation_id LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`),
    db.all<{ total: number }>(
      sql`SELECT count(*) AS total ${source} WHERE ${where}`,
    ),
  ]);
  return {
    items: rows.map(projectPublished),
    total: counts[0]?.total ?? 0,
    page,
    pageSize,
  };
}

export function getPost(db: Db, id: string) {
  return readAdminPost(db, sql`p.translation_id = ${id}`);
}

export function getPostTranslation(db: Db, postId: string, locale: Locale) {
  return readAdminPost(
    db,
    sql`p.content_id = ${postId} AND p.locale = ${locale}`,
  );
}

async function readAdminPost(db: Db, condition: SQL) {
  const row = await db.get<PostDetailRow>(
    sql`SELECT ${fields(true)}, p.body_markdown AS content, tr.revision,
      tr.seo_title AS seoTitle, tr.seo_description AS seoDescription,
      posts.cover_image AS sharedCoverImage, 1 - posts.use_shared_cover AS usesLegacyCover
    FROM current_articles p ${joins} WHERE ${condition}`,
  );
  if (!row) return undefined;
  const { usesLegacyCover, ...detail } = row;
  return { ...project(detail), usesLegacyCover: usesLegacyCover === 1 };
}

export async function getPublicPost(db: Db, locale: Locale, slug: string) {
  const row = await db.get<
    PostRow & { content: string }
  >(sql`SELECT ${fields()}, p.body_markdown AS content
    ${source} WHERE p.locale = ${locale} AND EXISTS (SELECT 1 FROM post_routes r
    WHERE r.locale = p.locale AND r.translation_id = p.translation_id AND r.route_path = ${`/articles/${slug}/`})`);
  return row ? projectPublished(row) : undefined;
}

function projectPublished<T extends PostRow>(row: T) {
  if (row.publishedAt === null || row.path === null || row.slug === null)
    throw new Error(
      "Published article is missing its publication date or article route.",
    );
  return {
    ...project(row),
    publishedAt: new Date(row.publishedAt).toISOString(),
    path: row.path,
    slug: row.slug,
  };
}
