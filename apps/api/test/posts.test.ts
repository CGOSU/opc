import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { treaty } from "@elysiajs/eden";
import { expect, test } from "vitest";
import type { App } from "../src/app";
import {
  getSessionCookie,
  initializeAdmin,
  queryAuthDb,
  withWorker,
  writeHeaders,
} from "./worker-harness";

async function client(origin: string, state: string) {
  const creds = {
    username: "PostCheck",
    password: randomBytes(24).toString("hex"),
  };
  const provisioned = initializeAdmin(state, creds.username, creds.password);
  expect(provisioned.status, provisioned.stderr).toBe(0);
  const api = treaty<App>(origin).api;
  const login = await api.admin.auth.login.post(creds, {
    headers: writeHeaders,
  });
  const Cookie = getSessionCookie(login.response);
  return {
    api,
    read: { headers: { Cookie } },
    write: { headers: { ...writeHeaders, Cookie } },
  };
}

function data<T>(result: { data: T | null; error: unknown }) {
  if (result.data === null) throw new Error(JSON.stringify(result.error));
  return result.data;
}

test("article creation, translation CAS and shared settings use independent atomic writes", async () => {
  await withWorker("src/index.ts", true, async (origin, state) => {
    const {
      api: { admin, public: published },
      read,
      write,
    } = await client(origin, state);
    const category = data(
      await admin.categories.post(
        { name: "Workers", slug: "workers", locale: "zh" },
        write,
      ),
    );
    const tag = data(
      await admin.tags.post({ name: "D1", slug: "d1", locale: "zh" }, write),
    );
    const topic = data(
      await admin.topics.post(
        { locale: "zh", title: "Worker series", slug: "worker-series" },
        write,
      ),
    );
    const base = {
      title: "Worker 指南",
      slug: "worker-guide",
      content: "## Worker",
    };
    const input = {
      ...base,
      locale: "zh" as const,
      categoryId: category.id,
      tagIds: [tag.id],
      topicIds: [topic.id],
    };
    expect((await admin.posts.post(input, read)).status).toBe(403);
    expect((await admin.posts.get()).status).toBe(401);
    expect(
      (await admin.posts.post({ ...input, topicIds: ["invalid"] }, write))
        .status,
    ).toBe(400);
    expect(
      (await admin.posts.post({ ...input, tagIds: [tag.id, tag.id] }, write))
        .status,
    ).toBe(400);
    expect(data(await admin.posts.get(read)).total).toBe(0);
    expect(
      queryAuthDb(state, "SELECT count(*) AS post_count FROM posts"),
    ).toMatch(/"post_count":\s*0/);

    const created = data(await admin.posts.post(input, write));
    const detail = admin.posts({ id: created.id });
    const original = data(await detail.get(read));
    expect(original.translations).toEqual([{ id: original.id, locale: "zh" }]);
    expect(original.revision).toBe(1);
    const post = admin.posts({ id: original.contentId });
    const en = post.translations({ locale: "en" });
    const zh = post.translations({ locale: "zh" });
    expect((await en.get(read)).status).toBe(404);
    expect((await en.put({ ...base, revision: 1 }, write)).error).toMatchObject(
      { status: 409, value: { error: { code: "REVISION_CONFLICT" } } },
    );
    expect((await en.get(read)).status).toBe(404);
    const english = {
      ...base,
      title: "Worker guide",
      slug: "worker-guide-en",
      seoTitle: "English SEO",
    };
    const enCreated = data(await en.post(english, write));
    expect(
      (await en.post({ ...english, slug: "other" }, write)).error,
    ).toMatchObject({
      status: 409,
      value: { error: { code: "DUPLICATE_LOCALE" } },
    });

    // Distinct post IDs can reuse a slug only across different locales.
    const crossLocale = data(
      await admin.posts.post(
        { ...base, title: "Independent English article", locale: "en" },
        write,
      ),
    );
    expect((await admin.posts.post(input, write)).status).toBe(409);
    expect(
      (await admin.posts.post({ ...english, locale: "en" }, write)).status,
    ).toBe(409);
    const beforeZh = data(await zh.get(read));
    const [clientA, clientB] = await Promise.all([en.get(read), en.get(read)]);
    const revA = data(clientA).revision;
    const revB = data(clientB).revision;
    expect([revA, revB]).toEqual([1, 1]);
    const changes = [
      {
        ...english,
        slug: "english-a",
        title: "Window A",
        content: "Saved by A",
        seoDescription: "A summary",
      },
      {
        ...english,
        slug: "english-b",
        title: "Window B",
        content: "Saved by B",
        seoDescription: "B summary",
      },
    ];
    const [a, b] = await Promise.all([
      en.put({ ...changes[0], revision: revA }, write),
      en.put({ ...changes[1], revision: revB }, write),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const winner = a.status === 200 ? changes[0] : changes[1];
    const loser = a.status === 200 ? changes[1] : changes[0];
    expect((a.status === 409 ? a : b).error).toMatchObject({
      value: { error: { code: "REVISION_CONFLICT" } },
    });
    const saved = data(await en.get(read));
    expect(saved).toMatchObject({ ...winner, id: enCreated.id, revision: 2 });
    expect(data(await zh.get(read))).toEqual(beforeZh);
    const oldEn = (slug: string) =>
      published.posts({ slug }).get({ query: { locale: "en" } });
    expect(data(await oldEn(english.slug)).path).toBe(
      `/en/articles/${winner.slug}/`,
    );
    expect((await oldEn(loser.slug)).status).toBe(404);
    expect(data(await oldEn(winner.slug))).not.toHaveProperty("contentId");

    // Body validation and removal of the legacy write route prevent bypassing the revision check.
    for (const [url, method, body] of [
      [`${original.contentId}/translations/en`, "PUT", winner],
      [
        `${original.contentId}/translations/en`,
        "PUT",
        { ...winner, revision: 2, categoryId: null },
      ],
      [`${original.id}`, "PATCH", { title: "Bypass" }],
    ] as const) {
      const response = await fetch(`${origin}/api/admin/posts/${url}`, {
        method,
        headers: { ...write.headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(method === "PATCH" ? 404 : 400);
    }
    expect((await en.put({ ...winner, revision: 2 }, read)).status).toBe(403);
    // A conflicting current slug and a reserved alias must both leave the row and canonical map intact.
    expect(
      (
        await en.put(
          { ...winner, revision: 2, slug: base.slug, content: "Invalid" },
          write,
        )
      ).status,
    ).toBe(409);
    const independent = data(
      await admin.posts({ id: crossLocale.id }).get(read),
    );
    expect(
      (
        await admin
          .posts({ id: independent.contentId })
          .translations({ locale: "en" })
          .put(
            {
              ...base,
              slug: "new-independent",
              revision: independent.revision,
            },
            write,
          )
      ).status,
    ).toBe(200);
    expect(
      (
        await en.put(
          { ...winner, revision: 2, slug: base.slug, content: "Invalid alias" },
          write,
        )
      ).status,
    ).toBe(409);
    expect(
      (await admin.posts.post({ ...english, locale: "en" }, write)).status,
    ).toBe(409);
    expect(data(await oldEn(base.slug)).path).toBe(
      "/en/articles/new-independent/",
    );
    expect(data(await en.get(read))).toEqual(saved);
    expect(data(await oldEn(english.slug)).path).toBe(
      `/en/articles/${winner.slug}/`,
    );

    const [zhUpdate, enUpdate] = await Promise.all([
      zh.put(
        {
          ...base,
          revision: 1,
          title: "Worker 已更新",
          slug: "worker-revised",
        },
        write,
      ),
      en.put({ ...winner, revision: 2, title: "Worker guide updated" }, write),
    ]);
    expect([data(zhUpdate).revision, data(enUpdate).revision]).toEqual([2, 3]);
    const latestZh = data(await zh.get(read));
    const latestEn = data(await en.get(read));
    expect(latestZh.publishedAt).toEqual(original.publishedAt);
    expect(data(await published.posts({ slug: input.slug }).get()).path).toBe(
      "/zh/articles/worker-revised/",
    );

    expect(
      (
        await post.settings.patch(
          { categoryId: null, tagIds: [], topicIds: ["invalid-topic"] },
          write,
        )
      ).status,
    ).toBe(400);
    expect(data(await zh.get(read))).toEqual(latestZh);
    expect(data(await en.get(read))).toEqual(latestEn);
    expect(
      data(await admin.topics({ id: topic.id }).get(read)).articles.map(
        ({ id }) => id,
      ),
    ).toEqual([original.contentId]);
    const cover = "https://assets.example.test/new-cover.png";
    expect(
      (await post.settings.patch({ coverImage: cover, topicIds: [] }, write))
        .status,
    ).toBe(200);
    expect(data(await zh.get(read))).toEqual({
      ...latestZh,
      coverImage: cover,
      sharedCoverImage: cover,
      topics: [],
    });
    expect(data(await en.get(read))).toEqual({
      ...latestEn,
      coverImage: cover,
      sharedCoverImage: cover,
      topics: [],
    });
    expect(
      queryAuthDb(state, "SELECT count(*) AS snapshots FROM content_revisions"),
    ).toMatch(/"snapshots":\s*0/);
    expect(
      data(
        await published
          .categories({ slug: "workers" })
          .posts.get({ query: { locale: "zh" } }),
      ).total,
    ).toBe(1);
    expect(
      data(
        await admin.posts.get({
          ...read,
          query: {
            tagId: tag.id,
            categoryId: category.id,
            page: 2,
            pageSize: 1,
          },
        }),
      ),
    ).toMatchObject({
      total: 2,
      page: 2,
      items: [{ contentId: original.contentId }],
    });
    expect(
      (await admin.categories({ id: category.id }).delete(undefined, write))
        .status,
    ).toBe(409);
    expect((await detail.delete(undefined, write)).status).toBe(200);
    expect((await detail.get(read)).status).toBe(404);
    expect((await published.posts({ slug: input.slug }).get()).status).toBe(
      404,
    );
    expect((await oldEn(winner.slug)).status).toBe(200);
    expect(
      (await admin.tags({ id: tag.id }).delete(undefined, write)).status,
    ).toBe(200);
    expect(data(await oldEn(winner.slug)).tags).toEqual([]);
    // Deleting/recreating a language cannot make an old revision valid again.
    const recreated = data(await zh.post(base, write));
    expect(
      (
        await zh.put(
          { ...base, content: "Old window", revision: latestZh.revision },
          write,
        )
      ).status,
    ).toBe(409);
    expect(data(await zh.get(read))).toMatchObject({
      content: base.content,
      revision: latestZh.revision + 1,
    });
    expect(
      (await admin.posts({ id: recreated.id }).delete(undefined, write)).status,
    ).toBe(200);
    expect(
      (await admin.posts({ id: enCreated.id }).delete(undefined, write)).status,
    ).toBe(200);
    expect(
      (await admin.categories({ id: category.id }).delete(undefined, write))
        .status,
    ).toBe(200);
    expect((await admin.posts({ id: crossLocale.id }).get(read)).status).toBe(
      200,
    );
  });
}, 45_000);

test("upgrading a populated 0007 D1 keeps article state, IDs, paths and required references", async () => {
  const fixtures = [
    "../../web/integration/articles.sql",
    "./fixtures/post-settings-0007.sql",
  ].map((file) => fileURLToPath(new URL(file, import.meta.url)));
  await withWorker("src/index.ts", fixtures, async (origin, state) => {
    const {
      api: { admin, public: published },
      read,
      write,
    } = await client(origin, state);
    const post = admin.posts({ id: "fixture" });
    const zh = post.translations({ locale: "zh" });
    const en = post.translations({ locale: "en" });
    const original = data(await zh.get(read));
    const originalEn = data(await en.get(read));
    expect(original).toMatchObject({
      id: "guide-zh",
      contentId: "fixture",
      title: "Workers 指南",
      seoTitle: "Workers 与 D1 指南",
      seoDescription: "Workers 与 D1 整合测试摘要",
      coverImage: "https://assets.example.test/old-zh.png",
      publishedAt: new Date("2024-01-01T00:00:00.000Z"),
      categoryId: "old-category",
      tags: [{ id: "old-tag" }],
      topics: [{ id: "old-topic" }],
    });
    expect(originalEn).toMatchObject({
      id: "guide-en",
      coverImage: "https://assets.example.test/old-en.png",
    });
    for (const [kind, id, name, slug] of [
      ["categories", "old-category", "Runtime", "runtime"],
      ["tags", "old-tag", "Workers", "workers"],
    ] as const) {
      expect(data(await admin[kind]({ id }).get(read))).toMatchObject({
        id,
        legacy: { name, slug },
        translations: [],
        articleCount: 1,
      });
      for (const locale of ["zh", "en"] as const) {
        expect(
          data(await published[kind].get({ query: { locale } })).items,
        ).toContainEqual({ name, slug, description: "" });
        expect(
          data(await published[kind]({ slug }).posts.get({ query: { locale } }))
            .total,
        ).toBe(1);
      }
      expect(
        (await admin[kind].post({ name: "Hijack", slug, locale: "en" }, write))
          .status,
      ).toBe(409);
    }
    expect(
      data(await admin.topics({ id: "old-topic" }).get(read)).articles.map(
        ({ id }) => id,
      ),
    ).toEqual(["lesson-1", "fixture"]);
    for (const id of ["draft", "withdrawn"]) {
      expect(
        data(await admin.posts({ id: `${id}-zh` }).get(read)).publishedAt,
      ).toBeNull();
      expect((await published.posts({ slug: id }).get()).status).toBe(404);
    }
    expect((await admin.posts({ id: "empty-en" }).get(read)).status).toBe(404);
    for (const id of ["guide-zh", "lesson-1-zh"]) {
      expect(
        (await admin.posts({ id }).delete(undefined, write)).error,
      ).toMatchObject({
        status: 409,
        value: { error: { code: "ARTICLE_REQUIRED_BY_SITE" } },
      });
    }
    expect(
      (
        await zh.put(
          {
            title: "新标题",
            slug: "migrated-guide",
            content: original.content,
            summary: original.summary,
            revision: original.revision,
          },
          write,
        )
      ).status,
    ).toBe(200);
    expect(
      (await published.posts({ slug: "old-workers" }).get()).data?.path,
    ).toBe("/zh/articles/migrated-guide/");
    expect(data(await zh.get(read)).seoTitle).toBe(original.seoTitle);
    expect(data(await en.get(read))).toEqual(originalEn);
    expect(
      data(await published.topics({ slug: "edge" }).get()).articles.map(
        ({ path }) => path,
      ),
    ).toContain("/zh/articles/migrated-guide/");
    expect(
      queryAuthDb(
        state,
        "SELECT base_href FROM published_navigation WHERE item_key = 'guide'",
      ),
    ).toContain("/zh/articles/migrated-guide/");
    expect(
      queryAuthDb(
        state,
        "SELECT count(*) AS snapshots FROM content_revisions WHERE translation_id = 'guide-zh'",
      ),
    ).toMatch(/"snapshots":\s*2/);
    const integrity = JSON.parse(
      queryAuthDb(state, "PRAGMA foreign_key_check"),
    );
    expect(integrity[0].results).toEqual([]);
    expect(
      (await post.settings.patch({ coverImage: null }, write)).status,
    ).toBe(200);
    for (const locale of [zh, en]) {
      const updated = data(await locale.get(read));
      expect(updated.usesLegacyCover).toBe(false);
      expect(updated.coverImage).toBeNull();
      expect(updated.revision).toBe(
        locale === zh ? original.revision + 1 : originalEn.revision,
      );
    }
    const oldCategory = admin.categories({ id: "old-category" });
    const englishCategory = oldCategory.translations({ locale: "en" });
    const migrated = await englishCategory.post(
      {
        name: "Runtime guides",
        slug: "runtime-guides",
        seoTitle: "Learn the runtime",
      },
      write,
    );
    expect(migrated.status).toBe(201);
    expect(data(await oldCategory.get(read))).toMatchObject({
      legacy: { slug: "runtime" },
      translations: [
        { locale: "en", slug: "runtime-guides", seoTitle: "Learn the runtime" },
      ],
    });
    const localized = published.categories({ slug: "runtime-guides" }).posts;
    expect((await localized.get({ query: { locale: "zh" } })).status).toBe(404);
    expect(
      data(await localized.get({ query: { locale: "en" } })).items.map(
        ({ category }) => category,
      ),
    ).toEqual(["Runtime guides"]);
    expect(
      data(await published.categories({ slug: "runtime" }).posts.get()).total,
    ).toBe(2);
    expect(data(await en.get(read)).categoryId).toBe("old-category");
  });
}, 45_000);
