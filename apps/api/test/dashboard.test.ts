import { treaty } from "@elysiajs/eden";
import { randomBytes } from "node:crypto";
import { expect, test } from "vitest";
import type { App } from "../src/app";
import {
  getSessionCookie,
  initializeAdmin,
  withWorker,
  writeHeaders,
} from "./worker-harness";

function requireData<T>({ data, error }: { data: T | null; error: unknown }) {
  if (!data) throw Error(`Unexpected API failure: ${JSON.stringify(error)}`);
  return data;
}

test("dashboard reports persisted counts and latest content without double-counting translations", async () => {
  await withWorker("src/index.ts", true, async (origin, state) => {
    const password = randomBytes(24).toString("hex");
    const username = "DashboardCheck";
    const provisioned = initializeAdmin(state, username, password);
    expect(provisioned.status, provisioned.stderr).toBe(0);
    const { admin } = treaty<App>(origin).api;
    expect((await admin.dashboard.get()).status).toBe(401);
    const login = await admin.auth.login.post(
      { username, password },
      { headers: writeHeaders },
    );
    const Cookie = getSessionCookie(login.response);
    const read = { headers: { Cookie } };
    const write = { headers: { ...writeHeaders, Cookie } };
    const dashboard = async () => requireData(await admin.dashboard.get(read));
    expect(await dashboard()).toEqual({
      counts: { posts: 0, topics: 0, categories: 0, tags: 0 },
      recentPosts: [],
      recentTopics: [],
    });

    const category = requireData(
      await admin.categories.post(
        { name: "Tech", slug: "tech", locale: "zh" },
        write,
      ),
    );
    const tag = requireData(
      await admin.tags.post(
        { name: "Workers", slug: "workers", locale: "zh" },
        write,
      ),
    );
    const postIds: string[] = [];
    const topicIds: string[] = [];
    for (let index = 0; index < 6; index++) {
      const title = `Dashboard article ${index}`;
      const post = requireData(
        await admin.posts.post(
          {
            locale: "zh",
            title,
            slug: `dashboard-post-${index}`,
            content: "Article",
          },
          write,
        ),
      );
      postIds.push(post.id);
      const topic = requireData(
        await admin.topics.post(
          {
            locale: "zh",
            title: `Topic ${index}`,
            slug: `dashboard-topic-${index}`,
          },
          write,
        ),
      );
      topicIds.push(topic.id);
    }

    const beforeEdit = await dashboard();
    expect(beforeEdit.counts).toEqual({
      posts: 6,
      topics: 6,
      categories: 1,
      tags: 1,
    });
    expect(beforeEdit.recentPosts.map(({ id }) => id)).toEqual(
      postIds.slice(1).reverse(),
    );
    expect(beforeEdit.recentTopics.map(({ id }) => id)).toEqual(
      topicIds.slice(1).reverse(),
    );

    const firstPost = admin.posts({ id: postIds[0] });
    const firstTopic = admin.topics({ id: topicIds[0] });
    const original = requireData(await firstPost.get(read));
    const { contentId, revision, content, slug } = original;
    if (!slug) throw new Error("Missing article slug.");
    requireData(
      await admin.posts({ id: contentId }).translations({ locale: "zh" }).put(
        {
          title: "Revised article",
          revision,
          slug,
          content,
        },
        write,
      ),
    );
    requireData(
      await firstTopic
        .translations({ locale: "zh" })
        .put({ title: "Revised topic", slug: "dashboard-topic-0" }, write),
    );
    const afterEdit = await dashboard();
    expect(afterEdit.recentPosts[0]).toMatchObject({
      id: postIds[0],
      title: "Revised article",
      locale: "zh",
    });
    expect(afterEdit.recentTopics.map(({ id }) => id)).toEqual(
      topicIds.slice(1).reverse(),
    );

    const english = requireData(
      await admin.posts({ id: contentId }).translations({ locale: "en" }).post(
        {
          title: "English article",
          slug: "dashboard-english",
          content: "Article",
        },
        write,
      ),
    );
    const translated = await dashboard();
    expect(translated.counts.posts).toBe(6);
    expect(translated.recentPosts[0]).toMatchObject({
      id: english.id,
      locale: "en",
    });
    expect(translated.recentPosts.map(({ id }) => id)).not.toContain(
      postIds[0],
    );

    requireData(await admin.posts({ id: english.id }).delete(undefined, write));
    expect((await dashboard()).recentPosts[0].id).toBe(postIds[0]);
    requireData(await firstPost.delete(undefined, write));
    requireData(
      await admin.topics({ id: topicIds[5] }).delete(undefined, write),
    );
    requireData(
      await admin.categories({ id: category.id }).delete(undefined, write),
    );
    requireData(await admin.tags({ id: tag.id }).delete(undefined, write));
    const final = await dashboard();
    expect(final.counts).toEqual({
      posts: 5,
      topics: 5,
      categories: 0,
      tags: 0,
    });
    expect(final.recentPosts.map(({ id }) => id)).toEqual(
      postIds.slice(1).reverse(),
    );
    expect(final.recentTopics.at(-1)).toMatchObject({
      id: topicIds[0],
      title: "Revised topic",
    });
  });
}, 30_000);
