import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { demo } from "../apps/web/src/data/demo.mjs";

const root = new URL("../", import.meta.url);
const path = fileURLToPath(new URL("data/content.sqlite", root));
if (existsSync(path))
  throw new Error(
    "Database already exists; refusing to overwrite. Use an explicit migration for existing content.",
  );
mkdirSync(new URL("data/", root), { recursive: true });
const db = new DatabaseSync(path);
try {
  db.exec("PRAGMA foreign_keys = ON");
  for (const file of ["astro_content_schema.sql", "astro_site_schema_0002.sql"])
    db.exec(readFileSync(new URL(file, root), "utf8"));
  db.exec("BEGIN");
  const now = Date.now();
  db.prepare(
    "INSERT INTO content_items (id, created_at_ms, kind) VALUES (?, ?, ?)",
  ).run("home", now, "page");
  for (const [locale, content] of Object.entries(demo)) {
    const translation = "home-" + locale;
    const revision = translation + "-1";
    db.prepare(
      "INSERT INTO content_translations (id, content_id, locale, created_at_ms) VALUES (?, ?, ?, ?)",
    ).run(translation, "home", locale, now);
    db.prepare(
      `INSERT INTO content_revisions (id, translation_id, revision_no, title, summary, body_markdown, noindex, created_at_ms, template_key, blocks_json) VALUES (?, ?, 1, ?, ?, '', 1, ?, 'home', ?)`,
    ).run(
      revision,
      translation,
      content.title,
      content.description,
      now,
      JSON.stringify([content]),
    );
    db.prepare("INSERT INTO content_revision_seals VALUES (?, ?)").run(
      revision,
      now,
    );
    db.prepare("INSERT INTO content_publications VALUES (?, ?, 1, ?, ?)").run(
      translation,
      revision,
      now,
      now,
    );
    db.prepare(
      "UPDATE content_routes SET translation_id = ?, system_key = NULL WHERE locale = ? AND system_key = 'home'",
    ).run(translation, locale);
    const siteId = "site-" + locale + "-1";
    db.prepare(
      "INSERT INTO site_revisions (id, locale, revision_no, site_name, default_description, created_at_ms) VALUES (?, ?, 1, ?, ?, ?)",
    ).run(siteId, locale, content.name, content.description, now);
    for (const slot of ["header_primary", "footer_main"]) {
      ["notes", "work", "services", "about"].forEach((fragment, position) => {
        db.prepare(
          `INSERT INTO site_menu_items (site_revision_id, slot, item_key, label, position, target_kind, target_content_id, fragment) VALUES (?, ?, ?, ?, ?, 'internal', 'home', ?)`,
        ).run(
          siteId,
          slot,
          fragment,
          content.nav[position],
          position,
          fragment,
        );
      });
    }
    db.prepare("UPDATE site_revisions SET sealed_at_ms = ? WHERE id = ?").run(
      now,
      siteId,
    );
    db.prepare("INSERT INTO site_publications VALUES (?, ?, ?)").run(
      locale,
      siteId,
      now,
    );
  }
  db.exec("COMMIT");
  console.log(
    "Created local sample database with sealed, published zh/en home snapshots.",
  );
} finally {
  db.close();
}
