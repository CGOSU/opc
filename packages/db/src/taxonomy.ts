import { sql, type SQL } from "drizzle-orm";
import { d1Batch, d1ErrorMessage } from "./batch";
import type { connectDb } from "./index";
import { taxonomies, type Kind } from "./taxonomy-schema";

type Db = ReturnType<typeof connectDb>;
type Locale = "zh" | "en";
type TermText = { name: string; slug: string; description: string };
type TranslationInput = Omit<TermText, "description"> & {
  description?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
};
type Translation = TermText & {
  locale: Locale;
  seoTitle: string | null;
  seoDescription: string | null;
  revision: number;
};
type TermRow = {
  id: string;
  name: string;
  sortOrder: number;
  articleCount: number;
  createdAt: number;
  updatedAt: number;
  versions: string;
  legacyName: string | null;
  legacySlug: string | null;
  legacyDescription: string | null;
};

function projection(kind: Kind) {
  const { main, translations, legacy, foreignKey, linkedCount } =
    taxonomies[kind];
  return sql`SELECT m.id, coalesce(zh.name, en.name, old.name) AS name,
    m.sort_order AS sortOrder, m.created_at_ms AS createdAt, m.updated_at_ms AS updatedAt,
    ${linkedCount} AS articleCount, old.name AS legacyName, old.slug AS legacySlug, old.description AS legacyDescription,
    (SELECT json_group_array(json_object('locale', t.locale, 'name', t.name, 'slug', t.slug,
      'description', t.description, 'seoTitle', t.seo_title, 'seoDescription', t.seo_description, 'revision', t.revision))
      FROM ${translations} t WHERE t.${foreignKey} = m.id) AS versions
    FROM ${main} m
    LEFT JOIN ${legacy} old ON old.${foreignKey} = m.id
    LEFT JOIN ${translations} zh ON zh.${foreignKey} = m.id AND zh.locale = 'zh'
    LEFT JOIN ${translations} en ON en.${foreignKey} = m.id AND en.locale = 'en'`;
}

function project({
  versions,
  legacyName,
  legacySlug,
  legacyDescription,
  createdAt,
  updatedAt,
  ...row
}: TermRow) {
  return {
    ...row,
    translations: JSON.parse(versions) as Translation[],
    legacy:
      legacyName === null || legacySlug === null
        ? null
        : {
            name: legacyName,
            slug: legacySlug,
            description: legacyDescription ?? "",
          },
    createdAt: new Date(createdAt).toISOString(),
    updatedAt: new Date(updatedAt).toISOString(),
  };
}

type PageQuery = { search?: string; page?: number; pageSize?: number };
export async function listTerms(
  db: Db,
  kind: Kind,
  query: PageQuery & {
    language?: "missing-en" | "bilingual";
  },
) {
  const { search, page = 1, pageSize = 20, language } = query;
  const { main, translations, legacy, foreignKey } = taxonomies[kind];
  const conditions = [sql`1 = 1`];
  if (search)
    conditions.push(sql`(EXISTS (
    SELECT 1 FROM ${translations} t WHERE t.${foreignKey} = m.id
      AND (instr(lower(t.name), lower(${search})) > 0 OR instr(t.slug, lower(${search})) > 0)
    ) OR EXISTS (SELECT 1 FROM ${legacy} old WHERE old.${foreignKey} = m.id
      AND (instr(lower(old.name), lower(${search})) > 0 OR instr(old.slug, lower(${search})) > 0)))`);
  if (language === "missing-en")
    conditions.push(sql`NOT EXISTS (
    SELECT 1 FROM ${translations} t WHERE t.${foreignKey} = m.id AND t.locale = 'en')`);
  if (language === "bilingual")
    conditions.push(sql`(SELECT count(*) FROM ${translations} t
     WHERE t.${foreignKey} = m.id AND t.locale IN ('zh', 'en')) = 2`);
  const where = sql.join(conditions, sql` AND `);
  const [rows, totals] = await Promise.all([
    db.all<TermRow>(sql`${projection(kind)} WHERE ${where} ORDER BY m.sort_order, name, m.id
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`),
    db.get<{ total: number; shared: number; zh: number; en: number }>(sql`SELECT
      (SELECT count(*) FROM ${main} m WHERE ${where}) AS total,
      (SELECT count(*) FROM ${main}) AS shared,
      (SELECT count(*) FROM ${translations} WHERE locale = 'zh') AS zh,
      (SELECT count(*) FROM ${translations} WHERE locale = 'en') AS en`),
  ]);
  if (!totals) throw new Error("Taxonomy counts unavailable.");
  const { total, ...counts } = totals;
  return { items: rows.map(project), total, page, pageSize, counts };
}

export async function getTerm(db: Db, kind: Kind, id: string) {
  const row = await db.get<TermRow>(
    sql`${projection(kind)} WHERE m.id = ${id}`,
  );
  return row && project(row);
}

export function getPublicTerm(
  db: Db,
  kind: Kind,
  slug: string,
  locale?: Locale,
) {
  const { routes } = taxonomies[kind];
  const scope = locale ? sql`AND locale = ${locale}` : sql``;
  return db.get<
    TermText & {
      id: string;
      seoTitle: string | null;
      seoDescription: string | null;
    }
  >(sql`
    SELECT id, name, slug, description, seo_title AS seoTitle, seo_description AS seoDescription
    FROM ${routes} WHERE slug = ${slug} ${scope}
    ORDER BY is_legacy, locale LIMIT 1`);
}

export async function listPublicTerms(
  db: Db,
  kind: Kind,
  query: PageQuery & { locale?: Locale },
) {
  const { search, locale = "zh", page = 1, pageSize = 20 } = query;
  const { main, localized } = taxonomies[kind];
  const filter = sql`r.locale = ${locale} AND instr(lower(r.name), lower(${search ?? ""})) > 0`;
  const [items, count] = await Promise.all([
    db.all<TermText>(sql`SELECT r.name, r.slug, r.description FROM ${localized} r
      JOIN ${main} m ON m.id = r.id WHERE ${filter} ORDER BY m.sort_order, r.name, r.id
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`),
    db.get<{ total: number }>(
      sql`SELECT count(*) AS total FROM ${localized} r WHERE ${filter}`,
    ),
  ]);
  if (!count) throw new Error("Public taxonomy count unavailable.");
  return { items, total: count.total, page, pageSize };
}

function insertTranslation(
  kind: Kind,
  id: string,
  locale: Locale,
  input: TranslationInput,
) {
  const { main, translations, foreignKey } = taxonomies[kind];
  return sql`INSERT INTO ${translations} (${foreignKey}, locale, name, slug, description, seo_title, seo_description)
    SELECT m.id, ${locale}, ${input.name.trim()}, ${input.slug}, ${input.description ?? ""},
      ${input.seoTitle ?? null}, ${input.seoDescription ?? null}
    FROM ${main} m WHERE m.id = ${id}`;
}

function saved(id: string) {
  return { ok: true, value: { id } } as const;
}

function missing() {
  return { ok: false, code: "TERM_NOT_FOUND" } as const;
}

function duplicateOrThrow(error: unknown) {
  const message = d1ErrorMessage(error);
  if (
    /DUPLICATE_TERM|UNIQUE constraint failed: (?:category|tag)_translations\./.test(
      message,
    )
  )
    return { ok: false, code: "DUPLICATE_TERM" } as const;
  throw error;
}

export async function createTerm(
  db: Db,
  kind: Kind,
  input: TranslationInput & { locale: Locale; sortOrder?: number },
) {
  const { main } = taxonomies[kind];
  const id = crypto.randomUUID();
  const now = Date.now();
  try {
    await d1Batch(db, [
      sql`INSERT INTO ${main} (id, sort_order, created_at_ms, updated_at_ms)
        VALUES (${id}, ${input.sortOrder ?? 0}, ${now}, ${now})`,
      insertTranslation(kind, id, input.locale, input),
    ]);
    return saved(id);
  } catch (error) {
    return duplicateOrThrow(error);
  }
}

export async function createTermTranslation(
  db: Db,
  kind: Kind,
  id: string,
  locale: Locale,
  input: TranslationInput,
) {
  try {
    const result = await db.run(insertTranslation(kind, id, locale, input));
    return result.meta.changes > 0 ? saved(id) : missing();
  } catch (error) {
    return duplicateOrThrow(error);
  }
}

export async function updateTermTranslation(
  db: Db,
  kind: Kind,
  id: string,
  locale: Locale,
  input: TranslationInput & { revision: number },
) {
  const { translations, foreignKey } = taxonomies[kind];
  try {
    const result = await db.run(sql`UPDATE ${translations}
      SET name = ${input.name.trim()}, slug = ${input.slug}, description = ${input.description ?? ""},
        seo_title = ${input.seoTitle ?? null}, seo_description = ${input.seoDescription ?? null}, revision = revision + 1
      WHERE ${foreignKey} = ${id} AND locale = ${locale} AND revision = ${input.revision}`);
    return result.meta.changes > 0
      ? saved(id)
      : ({ ok: false, code: "TERM_REVISION_CONFLICT" } as const);
  } catch (error) {
    return duplicateOrThrow(error);
  }
}

export async function updateTermSettings(
  db: Db,
  kind: Kind,
  id: string,
  sortOrder: number,
) {
  const { main } = taxonomies[kind];
  const result = await db.run(sql`UPDATE ${main} SET sort_order = ${sortOrder},
    updated_at_ms = ${Date.now()} WHERE id = ${id}`);
  return result.meta.changes > 0 ? saved(id) : missing();
}

export async function deleteTerm(db: Db, kind: Kind, id: string) {
  const { main } = taxonomies[kind];
  const guard: SQL =
    kind === "categories"
      ? sql`AND NOT EXISTS (SELECT 1 FROM posts WHERE category_id = ${id})`
      : sql``;
  const result = await db.run(
    sql`DELETE FROM ${main} WHERE id = ${id} ${guard}`,
  );
  if (result.meta.changes > 0) return saved(id);
  if (
    kind === "categories" &&
    (await db.get(sql`SELECT 1 FROM posts WHERE category_id = ${id} LIMIT 1`))
  )
    return { ok: false, code: "CATEGORY_IN_USE" } as const;
  return missing();
}
