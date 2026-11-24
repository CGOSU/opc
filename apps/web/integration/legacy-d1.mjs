import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Run real Wrangler migrations up to 0007, populate the old schema, then
// upgrade with the same state and migration ledger. Never edit the shared
// generated migrations directory: API test workers may run in parallel.
export function upgradeLegacyD1(state, fixtures, runD1) {
  const generated = new URL("../.wrangler/migrations/", import.meta.url);
  const migrations = join(state, "test-migrations");
  mkdirSync(migrations, { recursive: true });
  const final = [
    "0008_post_translations.sql",
    "0009_taxonomy_translations.sql",
    "0010_topic_translations.sql",
    "0011_jobs.sql",
  ];
  for (const file of readdirSync(generated)) {
    if (/^000[1-7]_.*\.sql$/.test(file)) {
      copyFileSync(new URL(file, generated), join(migrations, file));
    }
  }
  const config = join(state, "test-wrangler.json");
  writeFileSync(
    config,
    JSON.stringify({
      name: "opc-legacy-migration-test",
      d1_databases: [
        {
          binding: "CONTENT",
          database_name: "opc-content-local",
          database_id: "00000000-0000-4000-8000-000000000001",
          migrations_dir: "test-migrations",
          remote: false,
        },
      ],
    }),
  );
  const flags = [
    "CONTENT",
    "--local",
    "--persist-to",
    state,
    "--config",
    config,
  ];
  runD1("migrations", "apply", ...flags);
  for (const file of fixtures) runD1("execute", ...flags, "--file", file);
  for (const file of final)
    copyFileSync(new URL(file, generated), join(migrations, file));
  runD1("migrations", "apply", ...flags);
}
