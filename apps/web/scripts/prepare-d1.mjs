import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const project = new URL("../../../", import.meta.url);
const output = new URL("../.wrangler/migrations/", import.meta.url);
mkdirSync(output, { recursive: true });

const migrations = [
  ["0001_content.sql", "astro_content_schema.sql"],
  ["0002_site.sql", "astro_site_schema_0002.sql"],
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
