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

test("topic order is atomic, locale-aware and independent across topics", async () => {
  const oldFixtures = ["articles.sql", "topics-0007.sql"].map((name) =>
    fileURLToPath(new URL(`../../web/integration/${name}`, import.meta.url)),
  );
  await withWorker("src/index.ts", oldFixtures, async (origin, state) => {
    const credentials = {
      username: "TopicCheck",
      password: randomBytes(24).toString("hex"),
    };
    const provisioned = initializeAdmin(
      state,
      credentials.username,
      credentials.password,
    );
    expect(provisioned.status, provisioned.stderr).toBe(0);
    const { admin, public: published } = treaty<App>(origin).api;
    const login = await admin.auth.login.post(credentials, {
      headers: writeHeaders,
    });
    const Cookie = getSessionCookie(login.response);
    const read = { headers: { Cookie } };
    const write = { headers: { ...writeHeaders, Cookie } };
    const legacy = admin.topics({ id: "legacy-topic-id" });
    expect((await legacy.get(read)).data).toMatchObject({
      id: "legacy-topic-id",
      legacy: {
        title: "Legacy runtime guide",
        slug: "legacy-runtime",
        description: "Historical runtime notes.",
      },
      locales: [],
      translations: [],
      articleCount: 2,
      coverImage: "https://example.test/runtime-cover.jpg",
      articles: [{ id: "lesson-2" }, { id: "fixture" }],
    });
    const legacyPublic = published.topics({ slug: "legacy-runtime" });
    expect((await legacyPublic.get()).data).toMatchObject({
      title: "Legacy runtime guide",
    });
    expect(
      (await legacyPublic.get({ query: { locale: "en" } })).data?.articles.map(
        ({ title }) => title,
      ),
    ).toEqual(["Reading in a Worker"]);
    const legacyEn = legacy.translations({ locale: "en" });
    expect(
      (
        await legacyEn.post(
          { title: "English runtime", slug: "edge-learning" },
          write,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await legacyEn.post(
          { title: "English runtime", slug: "runtime-en" },
          write,
        )
      ).status,
    ).toBe(201);
    expect(
      (await legacyPublic.get({ query: { locale: "en" } })).data?.path,
    ).toBe("/en/topics/runtime-en/");
    expect((await legacyPublic.get()).data?.path).toBe(
      "/zh/topics/legacy-runtime/",
    );
    expect(
      (
        await admin.topics.post(
          { locale: "zh", title: "Conflict", slug: "old-edge" },
          write,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await admin.topics.post(
          { locale: "en", title: "Conflict", slug: "legacy-runtime" },
          write,
        )
      ).status,
    ).toBe(409);
    const integrity = JSON.parse(
      queryAuthDb(state, "PRAGMA foreign_key_check"),
    );
    expect(integrity[0].results).toEqual([]);
    const legacyPositions = JSON.parse(
      queryAuthDb(
        state,
        `
      SELECT sort_order FROM topic_posts WHERE topic_id = 'legacy-topic-id' ORDER BY sort_order
    `,
      ),
    );
    expect(legacyPositions[0].results).toEqual([
      { sort_order: 3 },
      { sort_order: 9 },
    ]);
    const first = (
      await admin.topics.post(
        {
          locale: "zh",
          title: "Worker Series",
          slug: "worker-series",
          sortOrder: 10,
        },
        write,
      )
    ).data;
    const second = (
      await admin.topics.post(
        { locale: "zh", title: "D1 Series", slug: "d1-series", sortOrder: -5 },
        write,
      )
    ).data;
    if (!first || !second) throw Error("Topic setup failed.");
    const main = admin.topics({ id: first.id });
    const other = admin.topics({ id: second.id });
    expect((await admin.topics.get()).status).toBe(401);
    expect((await main.posts.put([], read)).status).toBe(403);
    expect(
      (
        await admin.topics.post(
          { locale: "zh", title: "Duplicate", slug: "worker-series" },
          write,
        )
      ).status,
    ).toBe(409);
    const enRoute = main.translations({ locale: "en" });
    expect(
      (
        await published
          .topics({ slug: "worker-series" })
          .get({ query: { locale: "en" } })
      ).status,
    ).toBe(404);
    expect(
      (await enRoute.put({ title: "Missing", slug: "d1-series" }, write))
        .status,
    ).toBe(404);
    expect(
      (
        await enRoute.post(
          {
            title: "English Series",
            slug: "d1-series",
            seoTitle: "English SEO",
          },
          write,
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await main.translations({ locale: "zh" }).put(
          {
            title: "Worker Series",
            slug: "worker-series",
            description: "A hands-on guide",
          },
          write,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await main.settings.patch(
          { coverImage: "https://example.test/cover.jpg" },
          write,
        )
      ).status,
    ).toBe(200);
    expect((await main.get(read)).data).toMatchObject({
      locales: ["zh", "en"],
      coverImage: "https://example.test/cover.jpg",
      translations: expect.arrayContaining([
        expect.objectContaining({
          locale: "zh",
          description: "A hands-on guide",
          seoTitle: null,
        }),
        expect.objectContaining({
          locale: "en",
          slug: "d1-series",
          seoTitle: "English SEO",
        }),
      ]),
    });
    expect(
      (
        await admin.topics.get({
          ...read,
          query: { language: "bilingual", search: "English" },
        })
      ).data?.items.map(({ id }) => id),
    ).toEqual([first.id]);
    expect(
      (
        await admin.topics.get({
          ...read,
          query: { search: "series", pageSize: 1 },
        })
      ).data,
    ).toMatchObject({
      total: 2,
      items: [{ id: second.id }],
    });

    async function publish(title: string, slug: string, topicIds: string[]) {
      const created = await admin.posts.post(
        { locale: "zh", title, slug, content: "Article", topicIds },
        write,
      );
      if (!created.data)
        throw Error(
          `Could not create fixture: ${JSON.stringify(created.error)}`,
        );
      const detail = (await admin.posts({ id: created.data.id }).get(read))
        .data;
      if (!detail) throw Error("Could not read article fixture.");
      return detail;
    }
    const a = await publish("甲", "topic-first", [first.id, second.id]);
    const b = await publish("乙", "topic-second", [first.id]);
    const en = (
      await admin
        .posts({ id: a.contentId })
        .translations({ locale: "en" })
        .post(
          {
            title: "First",
            slug: "topic-first-en",
            content: "Article",
          },
          write,
        )
    ).data;
    if (!en) throw Error("Could not create translation.");
    expect(
      (await main.posts.put([b.contentId, a.contentId], write)).status,
    ).toBe(200);
    const ids = async () =>
      (await main.get(read)).data?.articles.map(({ id }) => id);
    expect(await ids()).toEqual([b.contentId, a.contentId]);
    expect(
      (await main.posts.put([a.contentId, a.contentId], write)).status,
    ).toBe(400);
    expect(
      (await main.posts.put([a.contentId, crypto.randomUUID()], write)).status,
    ).toBe(400);
    expect(
      (await admin.topics({ id: crypto.randomUUID() }).posts.put([], write))
        .status,
    ).toBe(404);
    expect(await ids()).toEqual([b.contentId, a.contentId]);
    // Use an unused position to exercise the member key, not the position key.
    const duplicate = JSON.parse(
      queryAuthDb(
        state,
        `
      INSERT OR IGNORE INTO topic_posts VALUES ('${first.id}', '${a.contentId}', 999);
      SELECT count(*) AS copies FROM topic_posts WHERE topic_id = '${first.id}' AND post_id = '${a.contentId}';
    `,
      ),
    );
    expect(duplicate.at(-1).results).toEqual([{ copies: 1 }]);
    expect(await ids()).toEqual([b.contentId, a.contentId]);
    expect((await other.get(read)).data?.articles.map(({ id }) => id)).toEqual([
      a.contentId,
    ]);
    expect(
      (await admin.posts.get({ ...read, query: { topicId: second.id } })).data
        ?.total,
    ).toBe(2);
    const bDetail = admin.posts({ id: b.id });
    const bSettings = admin.posts({ id: b.contentId }).settings;
    expect(
      (
        await bSettings.patch(
          { topicIds: [first.id, crypto.randomUUID()] },
          write,
        )
      ).status,
    ).toBe(400);
    expect(await ids()).toEqual([b.contentId, a.contentId]);

    const publicDetail = published.topics({ slug: "worker-series" });
    const zh = (await publicDetail.get()).data;
    expect(zh?.articles.map(({ title }) => title)).toEqual(["乙", "甲"]);
    expect(zh?.articles[0]).not.toHaveProperty("id");
    expect(zh).not.toHaveProperty("content_id");
    expect(
      (await published.topics.get({ query: { search: "series", pageSize: 1 } }))
        .data,
    ).toMatchObject({ total: 2, items: [{ slug: "d1-series" }] });
    const englishTitles = async () =>
      (
        await published
          .topics({ slug: "d1-series" })
          .get({ query: { locale: "en" } })
      ).data?.articles.map(({ title }) => title);
    expect(await englishTitles()).toEqual(["First"]);

    expect(
      (await admin.posts({ id: a.id }).delete(undefined, write)).status,
    ).toBe(200);
    expect(await ids()).toEqual([b.contentId, a.contentId]);
    expect(await englishTitles()).toEqual(["First"]);
    expect(
      (await admin.posts({ id: en.id }).delete(undefined, write)).status,
    ).toBe(200);
    expect(await ids()).toEqual([b.contentId]);
    expect((await other.get(read)).data?.articles).toEqual([]);
    expect((await main.delete(undefined, write)).status).toBe(200);
    expect((await publicDetail.get()).status).toBe(404);
    expect((await bDetail.get(read)).data?.topics).toEqual([]);
  });
}, 30_000);
