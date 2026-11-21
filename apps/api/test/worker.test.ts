import { createHash, randomBytes } from "node:crypto";
import { treaty } from "@elysiajs/eden";
import { expect, expectTypeOf, test } from "vitest";
import type { App } from "../src/app";
import { MAX_LOGIN_ATTEMPTS } from "../src/modules/auth/auth.service";
import type { ProbeApp } from "./fixtures/worker";
import {
  adminOrigin,
  getSessionCookie,
  initializeAdmin,
  queryAuthDb,
  withWorker,
  writeHeaders,
} from "./worker-harness";

test("the deployment entry liveness works without migrations; the probe isn't shipped", async () => {
  await withWorker("src/index.ts", false, async (origin) => {
    const { data, error } = await treaty<App>(origin).health.get();
    expect(error).toBeNull();
    expect(data).toEqual({
      status: "ok",
      service: "opc-api",
      check: "liveness",
    });

    const missing = await fetch(`${origin}/_integration/locales/en`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Route not found." },
    });
  });
}, 30_000);

test("Eden reads migrated D1 through Elysia schemas in workerd and handles errors", async () => {
  await withWorker("test/fixtures/worker.ts", true, async (origin) => {
    const locales = treaty<ProbeApp>(origin)._integration.locales;
    const { data, error } = await locales({ code: "zh" }).get();
    if (error) throw new Error(`Locale request failed: ${error.status}`);
    expectTypeOf(data).toEqualTypeOf<{ code: string; langTag: string }>();
    expect(data).toEqual({ code: "zh", langTag: "zh-Hans" });

    const absent = await locales({ code: "zz" }).get();
    expect(absent.error).toMatchObject({
      status: 404,
      value: { error: { code: "LOCALE_NOT_FOUND" } },
    });

    const invalid = await fetch(`${origin}/_integration/locales/invalid`);
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({
      error: { code: "INVALID_REQUEST", message: "Invalid request." },
    });

    const invalidOutput = await fetch(`${origin}/_integration/locales/xx`);
    expect(invalidOutput.status).toBe(500);
    expect(await invalidOutput.json()).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Internal server error." },
    });
  });
}, 30_000);

test("taxonomy CRUD, uniqueness and link rules work against isolated D1", async () => {
  await withWorker("src/index.ts", true, async (origin, state) => {
    const creds = {
      username: "TaxonomyCheck",
      password: randomBytes(24).toString("hex"),
    };
    const initialized = initializeAdmin(state, creds.username, creds.password);
    expect(initialized.status, initialized.stderr).toBe(0);
    const { auth, categories, tags } = treaty<App>(origin).api.admin;
    const login = await auth.login.post(creds, { headers: writeHeaders });
    const session = { Cookie: getSessionCookie(login.response) };
    const read = { headers: session };
    const write = { headers: { ...writeHeaders, ...session } };

    for (const terms of [categories, tags]) {
      const input = {
        name: "Web development",
        slug: "web-dev",
        description: "Stack notes",
        locale: "zh" as const,
      };
      expect((await terms.get()).status).toBe(401);
      expect((await terms.post(input, { headers: writeHeaders })).status).toBe(
        401,
      );
      expect((await terms.post(input, read)).status).toBe(403);
      expect(
        (
          await terms.post(input, {
            headers: { ...write.headers, Origin: "https://wrong.example" },
          })
        ).status,
      ).toBe(403);
      expect((await terms.post({ ...input, name: "  " }, write)).status).toBe(
        400,
      );
      expect(
        (await terms.get({ ...read, query: { pageSize: 51 } })).status,
      ).toBe(400);
      const first = await terms.post(input, write);
      if (first.error || !first.data)
        throw new Error(
          `Failed creating first term: ${JSON.stringify(first.error)}`,
        );
      const detail = terms({ id: first.data.id });
      expect(first.status).toBe(201);
      const zh = detail.translations({ locale: "zh" });
      const en = detail.translations({ locale: "en" });
      expect((await detail.get(read)).data).toMatchObject({
        articleCount: 0,
        legacy: null,
        translations: [{ ...input, revision: 1 }],
      });
      for (const conflicting of [
        { ...input, name: " Web development ", slug: "other" },
        { ...input, name: "Other" },
      ]) {
        expect((await terms.post(conflicting, write)).error).toMatchObject({
          status: 409,
          value: { error: { code: "DUPLICATE_TERM" } },
        });
      }
      const second = await terms.post(
        { name: "Web access", slug: "web-access", locale: "zh" },
        write,
      );
      if (second.error || !second.data)
        throw new Error("Failed creating second term.");
      const change = {
        name: "Programming",
        description: "",
        slug: "programming",
        revision: 1,
      };
      expect(
        (await zh.put({ ...change, slug: "web-access" }, write)).status,
      ).toBe(409);
      expect((await detail.get(read)).data?.translations).toMatchObject([
        { ...input, revision: 1 },
      ]);
      expect((await en.put(change, write)).status).toBe(409);
      expect(
        (await en.post({ name: "Web English", slug: "web-access" }, write))
          .status,
      ).toBe(201);
      expect((await zh.put(change, write)).status).toBe(200);
      expect(
        (await zh.put({ ...change, name: "Stale" }, write)).error,
      ).toMatchObject({
        status: 409,
        value: { error: { code: "TERM_REVISION_CONFLICT" } },
      });
      expect((await detail.get(read)).data?.translations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            locale: "zh",
            name: "Programming",
            slug: "programming",
            revision: 2,
          }),
          expect.objectContaining({
            locale: "en",
            name: "Web English",
            slug: "web-access",
            revision: 1,
          }),
        ]),
      );
      const filtered = await terms.get({
        ...read,
        query: { search: "WEB", language: "missing-en", page: 1, pageSize: 1 },
      });
      expect(filtered.data).toMatchObject({
        total: 1,
        items: [{ id: second.data.id }],
      });
      const bilingual = await terms.get({
        ...read,
        query: { language: "bilingual" },
      });
      expect(bilingual.data).toMatchObject({
        total: 1,
        items: [{ id: first.data.id }],
        counts: { shared: 2, zh: 2, en: 1 },
      });
      const beforeSettings = (await detail.get(read)).data?.translations;
      const movedFirst = await detail.settings.patch({ sortOrder: 2 }, write);
      const movedSecond = await terms({ id: second.data.id }).settings.patch(
        { sortOrder: -1 },
        write,
      );
      expect([movedFirst.status, movedSecond.status]).toEqual([200, 200]);
      const sorted = await terms.get({
        ...read,
        query: { page: 2, pageSize: 1 },
      });
      expect(sorted.data).toMatchObject({
        total: 2,
        page: 2,
        items: [
          { id: first.data.id, sortOrder: 2, translations: beforeSettings },
        ],
      });
      expect((await detail.delete(undefined, write)).status).toBe(200);
      expect((await detail.get(read)).status).toBe(404);
      expect(
        (await detail.settings.patch({ sortOrder: 0 }, write)).status,
      ).toBe(404);
    }

    const category = (await categories.get(read)).data?.items[0];
    const tag = (await tags.get(read)).data?.items[0];
    if (!category || !tag) throw new Error("Expected persisted taxonomy rows.");
    queryAuthDb(
      state,
      "INSERT INTO content_items (id, created_at_ms) VALUES ('test-article', 0)",
    );
    queryAuthDb(
      state,
      `INSERT INTO posts (id, category_id, created_at_ms, updated_at_ms) VALUES ('test-article', '${category.id}', 0, 0)`,
    );
    queryAuthDb(
      state,
      `INSERT INTO post_tags VALUES ('test-article', '${tag.id}')`,
    );
    expect((await categories.get(read)).data?.items[0].articleCount).toBe(1);
    expect((await tags({ id: tag.id }).get(read)).data?.articleCount).toBe(1);
    expect(
      (await categories({ id: category.id }).delete(undefined, write)).error,
    ).toMatchObject({
      status: 409,
      value: { error: { code: "CATEGORY_IN_USE" } },
    });
    expect((await tags({ id: tag.id }).delete(undefined, write)).status).toBe(
      200,
    );
    expect(
      queryAuthDb(
        state,
        "SELECT id FROM content_items WHERE id = 'test-article'",
      ),
    ).toContain("test-article");
    expect(
      queryAuthDb(state, "SELECT count(*) AS linked FROM post_tags"),
    ).toMatch(/"linked":\s*0/);
  });
}, 30_000);

test("local provisioning and typed session lifecycle work against isolated D1", async () => {
  await withWorker("src/index.ts", true, async (origin, state) => {
    const creds = {
      username: "AuthCheck",
      password: ` ${randomBytes(2).toString("hex").slice(0, 3)} `,
    };
    const shortPassword = creds.password.slice(1);
    expect(initializeAdmin(state, creds.username, shortPassword).status).toBe(
      1,
    );
    const initialized = initializeAdmin(state, creds.username, creds.password);
    expect(initialized.status, initialized.stderr).toBe(0);
    expect(initializeAdmin(state, "OtherAdmin", creds.password).status).toBe(1);
    const stored = queryAuthDb(state, "SELECT password_hash FROM admins");
    expect(stored.includes(creds.password)).toBe(false);
    expect(stored.includes("pbkdf2-sha256$100000$")).toBe(true);

    const auth = treaty<App>(origin).api.admin.auth;
    expect((await auth.me.get()).error?.status).toBe(401);
    expect(
      (await auth.logout.post(undefined, { headers: writeHeaders })).error
        ?.status,
    ).toBe(401);
    expect(
      (
        await auth.login.post(creds, {
          headers: { ...writeHeaders, Origin: "https://untrusted.example" },
        })
      ).error?.status,
    ).toBe(403);
    const malformed = await auth.login.post(
      { ...creds, username: "not allowed" },
      { headers: writeHeaders },
    );
    expect(malformed.error?.status).toBe(400);
    expect(malformed.response.headers.get("cache-control")).toBe("no-store");
    const tooShort = await auth.login.post(
      { ...creds, password: shortPassword },
      { headers: writeHeaders },
    );
    expect(tooShort.error?.status).toBe(400);

    const wrong = await auth.login.post(
      { ...creds, password: `${creds.password.trim()}  ` },
      { headers: writeHeaders },
    );
    const unknown = await auth.login.post(
      { ...creds, username: creds.username.toLowerCase() },
      { headers: writeHeaders },
    );
    expect(wrong.error?.status).toBe(401);
    expect(unknown.error?.status).toBe(401);
    expect(wrong.error?.value).toEqual(unknown.error?.value);
    expect(wrong.response.headers.has("set-cookie")).toBe(false);

    const login = await auth.login.post(creds, { headers: writeHeaders });
    if (login.error)
      throw new Error(
        `Login failed: ${login.response.status}, ${JSON.stringify(login.error.value)}`,
      );
    expectTypeOf(login.data).toEqualTypeOf<{ id: string; username: string }>();
    expect(login.data.username).toBe(creds.username);
    const cookie = getSessionCookie(login.response);
    const rawToken = cookie.slice(cookie.indexOf("=") + 1);
    const sessions = queryAuthDb(state, "SELECT token_hash FROM sessions");
    expect(sessions.includes(rawToken)).toBe(false);
    expect(
      sessions.includes(createHash("sha256").update(rawToken).digest("hex")),
    ).toBe(true);

    const retry = await auth.login.post(creds, { headers: writeHeaders });
    const expiredCookie = getSessionCookie(retry.response);
    expect(expiredCookie === cookie).toBe(false);
    const expiredHash = createHash("sha256")
      .update(expiredCookie.split("=")[1])
      .digest("hex");
    queryAuthDb(
      state,
      `UPDATE sessions SET expires_at = 0 WHERE token_hash = '${expiredHash}'`,
    );
    expect(
      (await auth.me.get({ headers: { Cookie: expiredCookie } })).error?.status,
    ).toBe(401);

    const headers = { ...writeHeaders, Cookie: cookie };
    expect(
      (
        await auth.logout.post(undefined, {
          headers: { ...headers, Origin: "https://untrusted.example" },
        })
      ).error?.status,
    ).toBe(403);
    expect(
      (
        await auth.logout.post(undefined, {
          headers: { Origin: adminOrigin, Cookie: cookie },
        })
      ).error?.status,
    ).toBe(403);
    expect(
      (
        await auth.logout.post(undefined, {
          headers: { "X-OPC-CSRF": "1", Cookie: cookie },
        })
      ).error?.status,
    ).toBe(403);
    expect((await auth.me.get({ headers })).data).toEqual(login.data);
    const logout = await auth.logout.post(undefined, { headers });
    expect(logout.data).toEqual({ ok: true });
    expect(logout.response.headers.get("set-cookie")).toMatch(/; Max-Age=0/i);
    expect((await auth.me.get({ headers })).error?.status).toBe(401);
  });
}, 60_000);

test("login limit atomically rejects attempts over the threshold and recovers after expiry", async () => {
  await withWorker("src/index.ts", true, async (origin, state) => {
    const auth = treaty<App>(origin).api.admin.auth;
    const login = () =>
      auth.login.post(
        { username: "Unknown", password: randomBytes(20).toString("hex") },
        { headers: writeHeaders },
      );
    const attempts = await Promise.all(
      Array.from({ length: MAX_LOGIN_ATTEMPTS + 2 }, login),
    );
    expect(attempts.filter(({ error }) => error?.status === 401)).toHaveLength(
      MAX_LOGIN_ATTEMPTS,
    );
    const limited = attempts.filter(({ error }) => error?.status === 429);
    expect(limited).toHaveLength(2);
    expect(limited[0].response.headers.get("retry-after")).toBeTruthy();
    queryAuthDb(state, "UPDATE admin_login_limits SET expires_at = 0");
    expect((await login()).error?.status).toBe(401);
  });
}, 60_000);
