import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const project = new URL("../../../", import.meta.url);
const output = new URL("../.wrangler/migrations/", import.meta.url);
mkdirSync(output, { recursive: true });

const migrations = [
  ["0001_content.sql", "astro_content_schema.sql"],
  ["0002_site.sql", "astro_site_schema_0002.sql"],
  ["0003_auth.sql", "astro_auth_schema_0003.sql"],
  ["0004_taxonomy.sql", "astro_taxonomy_schema_0004.sql"],
  ["0005_posts.sql", "astro_posts_schema_0005.sql"],
  ["0006_topics.sql", "astro_topics_schema_0006.sql"],
  ["0007_site_settings.sql", "astro_site_settings_schema_0007.sql"],
  ["0008_post_translations.sql", "astro_post_translations_schema_0008.sql"],
  [
    "0009_taxonomy_translations.sql",
    "astro_taxonomy_translations_schema_0009.sql",
  ],
  ["0010_topic_translations.sql", "astro_topic_translations_schema_0010.sql"],
];

for (const [name, source] of migrations) {
  const sql = readFileSync(new URL(source, project), "utf8");
  // Wrangler owns the transaction; D1 enforces FKs. Keep trigger bodies intact.
  const migration = sql.replace(
    /^(?:BEGIN;|COMMIT;|PRAGMA foreign_keys = ON;|PRAGMA foreign_key_check;)[ \t]*\r?\n/gm,
    "",
  );
  writeFileSync(new URL(name, output), migration);
}
