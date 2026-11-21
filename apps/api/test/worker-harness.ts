import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect } from "vitest";
import { unstable_dev } from "wrangler";
import { upgradeLegacyD1 } from "../../web/integration/legacy-d1.mjs";

const require = createRequire(import.meta.url);
const wrangler = join(
  dirname(require.resolve("wrangler/package.json")),
  "bin/wrangler.js",
);

export async function withWorker(
  entry: string,
  migrate: boolean | readonly string[],
  exercise: (origin: string, state: string) => Promise<void>,
) {
  const state = mkdtempSync(join(tmpdir(), "opc-api-d1-"));
  try {
    if (migrate) {
      const runD1 = (...args: string[]) =>
        execFileSync(
          process.execPath,
          [wrangler, "d1", ...args, "--local", "--persist-to", state],
          { stdio: ["ignore", "inherit", "inherit"] },
        );
      if (typeof migrate === "boolean") runD1("migrations", "apply", "CONTENT");
      else
        upgradeLegacyD1(state, migrate, (...args) =>
          execFileSync(process.execPath, [wrangler, "d1", ...args], {
            stdio: ["ignore", "inherit", "inherit"],
          }),
        );
      if (entry === "test/fixtures/worker.ts") {
        // This row passes SQLite's constraints but fails the fixture's response schema.
        runD1(
          "execute",
          "CONTENT",
          "--command",
          "INSERT INTO site_locales (code, lang_tag, display_name) VALUES ('xx', 'x', 'Invalid locale')",
        );
      }
    }
    const worker = await unstable_dev(entry, {
      config: "wrangler.jsonc",
      local: true,
      ip: "127.0.0.1",
      port: 0,
      persistTo: state,
      inspect: false,
      experimental: {
        disableDevRegistry: true,
        disableExperimentalWarning: true,
        watch: false,
      },
    });
    try {
      await exercise(`http://${worker.address}:${worker.port}`, state);
    } finally {
      await worker.stop();
    }
  } finally {
    rmSync(state, { recursive: true, force: true });
  }
}

export const adminOrigin = "http://localhost:5173";
export const writeHeaders = { Origin: adminOrigin, "X-OPC-CSRF": "1" };

export function initializeAdmin(
  state: string,
  username: string,
  password: string,
) {
  return spawnSync(
    "bun",
    [
      "run",
      "admin:create:local",
      username,
      "--password-stdin",
      "--persist-to",
      state,
    ],
    {
      input: password,
      encoding: "utf8",
      timeout: 15_000,
    },
  );
}

export function getSessionCookie(response: Response) {
  const header = response.headers.get("set-cookie");
  if (!header) throw new Error("No session cookie was set.");
  expect(header).toMatch(/; HttpOnly/i);
  expect(header).toMatch(/; Secure/i);
  expect(header).toMatch(/; SameSite=Strict/i);
  expect(header).toMatch(/; Path=\//i);
  expect(header).not.toMatch(/; Domain=/i);
  const pair = header.split(";", 1)[0];
  if (!/^__Host-opc-session=[A-Za-z0-9_-]{43}$/.test(pair)) {
    throw new Error("Invalid session cookie format.");
  }
  return pair;
}

export function queryAuthDb(state: string, command: string) {
  return execFileSync(
    process.execPath,
    [
      wrangler,
      "d1",
      "execute",
      "CONTENT",
      "--local",
      "--persist-to",
      state,
      "--command",
      command,
      "--json",
    ],
    { encoding: "utf8" },
  );
}
