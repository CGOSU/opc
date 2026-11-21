import { sql } from "drizzle-orm";

// Only known identifiers reach the dynamic taxonomy queries.
export const taxonomies = {
  categories: {
    main: sql`categories`,
    translations: sql`category_translations`,
    legacy: sql`legacy_categories`,
    foreignKey: sql`category_id`,
    routes: sql`category_routes`,
    localized: sql`localized_categories`,
    linkedCount: sql`(SELECT count(*) FROM posts WHERE category_id = m.id)`,
  },
  tags: {
    main: sql`tags`,
    translations: sql`tag_translations`,
    legacy: sql`legacy_tags`,
    foreignKey: sql`tag_id`,
    routes: sql`tag_routes`,
    localized: sql`localized_tags`,
    linkedCount: sql`(SELECT count(*) FROM post_tags WHERE tag_id = m.id)`,
  },
} as const;

export type Kind = keyof typeof taxonomies;
