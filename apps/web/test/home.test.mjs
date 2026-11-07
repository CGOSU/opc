import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { spawnSync } from "node:child_process";
import { getHome } from "../src/lib/home.ts";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

test("published homepage ignores newer drafts; missing, offline and malformed snapshots fail closed", () => {
  const dir = mkdtempSync(join(tmpdir(), "opc-home-"));
  const path = join(dir, "content.sqlite");
  cpSync(join(repositoryRoot, "data/content.sqlite"), path);
  const previous = process.env.CONTENT_DB;
  process.env.CONTENT_DB = path;
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  try {
    const original = getHome("zh");
    assert.equal(original.noindex, true);
    const row = db
      .prepare("SELECT * FROM content_revisions WHERE id = 'home-zh-1'")
      .get();
    db.prepare(
      `INSERT INTO content_revisions (id, translation_id, revision_no, title, body_markdown, created_at_ms, template_key, blocks_json) VALUES ('draft-2', 'home-zh', 2, 'UNPUBLISHED', '', ?, 'home', '[]')`,
    ).run(row.created_at_ms);
    assert.deepEqual(getHome("zh"), original);
    db.exec(
      "UPDATE content_publications SET is_live = 0 WHERE translation_id = 'home-zh'",
    );
    assert.throws(() => getHome("zh"), /No published homepage/);
    assert.doesNotThrow(() => getHome("en"));
    assert.throws(
      () =>
        db.exec(
          "UPDATE content_publications SET revision_id = 'draft-2' WHERE translation_id = 'home-zh'",
        ),
      /sealed/,
    );
    db.prepare("INSERT INTO content_revision_seals VALUES ('draft-2', ?)").run(
      row.created_at_ms,
    );
    db.exec(
      "UPDATE content_publications SET revision_id = 'draft-2', is_live = 1 WHERE translation_id = 'home-zh'",
    );
    assert.throws(() => getHome("zh"), /Invalid homepage snapshot/);
    assert.throws(() => getHome("fr"), /No published homepage/);
    db.exec("DELETE FROM site_publications WHERE locale = 'en'");
    assert.throws(() => getHome("en"), /No published site configuration/);
  } finally {
    db.close();
    if (previous === undefined) delete process.env.CONTENT_DB;
    else process.env.CONTENT_DB = previous;
    rmSync(dir, { recursive: true });
  }
});

test("missing database fails without creating an empty database", () => {
  const dir = mkdtempSync(join(tmpdir(), "opc-missing-db-"));
  const path = join(dir, "missing.sqlite");
  const previous = process.env.CONTENT_DB;
  try {
    process.env.CONTENT_DB = path;
    assert.throws(() => getHome("zh"), /unable to open database/i);
    assert.equal(existsSync(path), false);
    delete process.env.CONTENT_DB;
    assert.throws(() => getHome("zh"), /CONTENT_DB must be configured/);
  } finally {
    if (previous === undefined) delete process.env.CONTENT_DB;
    else process.env.CONTENT_DB = previous;
    rmSync(dir, { recursive: true });
  }
});

test("sample initializer refuses to overwrite existing content", () => {
  const result = spawnSync(process.execPath, ["scripts/seed.mjs"], {
    encoding: "utf8",
    cwd: repositoryRoot,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refusing to overwrite/);
});
