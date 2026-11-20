import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const app = fileURLToPath(new URL("../", import.meta.url));
const wrangler = join(
  dirname(require.resolve("wrangler/package.json")),
  "bin/wrangler.js",
);
const astro = join(
  dirname(require.resolve("astro/package.json")),
  "bin/astro.mjs",
);
const site = "https://opc.example.test";
const zh = "/zh/articles/workers-guide/";
const en = "/en/articles/worker-notes/";
const env = { ...process.env, WRANGLER_SEND_METRICS: "false" };

function run(script, args, extraEnv = {}) {
  try {
    return execFileSync(process.execPath, [script, ...args], {
      cwd: app,
      env: { ...env, ...extraEnv },
      encoding: "utf8",
      timeout: 30_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    assert.fail(
      `${error.message}\n${error.stdout ?? ""}\n${error.stderr ?? ""}`,
    );
  }
}

async function worker(t, state) {
  const server = spawn(
    process.execPath,
    [
      wrangler,
      "dev",
      "--local",
      "--config",
      "dist/server/wrangler.json",
      "--ip",
      "127.0.0.1",
      "--port",
      "0",
      "--persist-to",
      state,
      "--var",
      "CONTENT_ASSET_BASE_URL:https://assets.example.test/content/",
      "--show-interactive-dev-session=false",
    ],
    { cwd: app, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  const exited = once(server, "exit");
  t.after(async () => {
    server.kill();
    await exited;
  });
  let log = "";
  const origin = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Worker unavailable:\n" + log)),
      20_000,
    );
    server.once("exit", () => {
      clearTimeout(timer);
      reject(new Error("Worker exited:\n" + log));
    });
    server.stdout.on("data", (data) => {
      log += data;
      const ready = /Ready on (http:\/\/127\.0\.0\.1:\d+)/.exec(log);
      if (ready) {
        clearTimeout(timer);
        resolve(ready[1]);
      }
    });
    server.stderr.on("data", (data) => {
      log += data;
    });
  });
  return async (path) =>
    fetch(origin + path, {
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });
}

function jsonLd(html) {
  return Object.fromEntries(
    [
      ...html.matchAll(/<script type="application\/ld\+json">(.+?)<\/script>/g),
    ].map((match) => {
      const parsed = JSON.parse(match[1]);
      return [parsed["@type"], parsed];
    }),
  );
}

test(
  "local D1 article routes read only the current sealed publication",
  { timeout: 90_000 },
  async (t) => {
    const temp = mkdtempSync(join(tmpdir(), "opc-article-test-"));
    const state = join(temp, "published");
    t.after(() => rmSync(temp, { recursive: true, force: true }));
    run("scripts/prepare-d1.mjs", []);
    run(wrangler, [
      "d1",
      "migrations",
      "apply",
      "CONTENT",
      "--local",
      "--persist-to",
      state,
    ]);
    run(wrangler, [
      "d1",
      "execute",
      "CONTENT",
      "--local",
      "--persist-to",
      state,
      "--file",
      "integration/articles.sql",
    ]);
    await t.test(
      "preview exposes no index or absolute discovery URLs",
      async (preview) => {
        run(astro, ["build"], { SITE_URL: "" });
        const request = await worker(preview, state);
        const robots = await request("/robots.txt");
        assert.equal(robots.status, 200);
        assert.doesNotMatch(await robots.text(), /Sitemap:|Disallow:/);
        for (const path of ["/sitemap.xml", "/zh/rss.xml", "/en/rss.xml"]) {
          assert.equal((await request(path)).status, 404, path);
        }
        const article = await (await request(zh)).text();
        assert.match(article, /name="robots" content="noindex, follow"/);
        assert.doesNotMatch(article, /rel="canonical"|application\/rss\+xml/);
      },
    );

    run(astro, ["build"], { SITE_URL: site });
    const request = await worker(t, state);

    async function discovery(path, mime) {
      const response = await request(path);
      assert.equal(response.status, 200, path);
      assert.equal(
        response.headers.get("content-type"),
        mime + "; charset=utf-8",
      );
      assert.equal(response.headers.get("cache-control"), "no-store");
      return response.text();
    }
    const getSitemap = () => discovery("/sitemap.xml", "application/xml");
    const getFeed = (locale) =>
      discovery(`/${locale}/rss.xml`, "application/rss+xml");
    const topic = "/zh/topics/edge/";
    const otherTopic = "/en/topics/edge-learning/";
    const robots = await request("/robots.txt");
    assert.equal(robots.status, 200);
    assert.equal(
      await robots.text(),
      `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`,
    );
    const sitemap = await getSitemap();
    const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => new URL(match[1]).pathname,
    );
    assert.deepEqual(
      paths.sort(),
      [
        "/en/",
        "/en/articles/",
        en,
        "/en/topics/",
        otherTopic,
        "/zh/",
        "/zh/articles/",
        zh,
        "/zh/topics/",
        topic,
        ...Array.from({ length: 6 }, (_, i) => `/zh/articles/lesson-${i + 1}/`),
      ].sort(),
    );
    for (const path of paths) {
      const response = await request(path);
      assert.equal(response.status, 200, path);
      const html = await response.text();
      assert.ok(html.includes(`rel="canonical" href="${site}${path}"`), path);
      assert.ok(!html.includes('content="noindex, follow"'), path);
    }
    assert.ok(
      sitemap.includes(
        `<loc>${site}${zh}</loc><lastmod>2024-01-02T00:00:00.000Z</lastmod>`,
      ),
    );
    assert.match(
      await (await request("/zh/articles/unlisted/")).text(),
      /name="robots" content="noindex, follow"/,
    );
    const zhFeed = await getFeed("zh");
    const enFeed = await getFeed("en");
    assert.ok(zhFeed.includes(`<guid isPermaLink="true">${site}${zh}</guid>`));
    assert.ok(!zhFeed.includes(`${site}${en}`));
    assert.doesNotMatch(zhFeed, /unlisted|old-workers|withdrawn|draft/);
    assert.ok(enFeed.includes(`<guid isPermaLink="true">${site}${en}</guid>`));
    assert.ok(!enFeed.includes(`${site}${zh}`));
    assert.match(enFeed, /English fixture &amp; &lt;XML&gt; summary/);
    assert.match(enFeed, /Mon, 01 Jan 2024 00:00:00 GMT/);
    const topicResponse = await request(topic);
    assert.equal(topicResponse.status, 200);
    const topicHtml = await topicResponse.text();
    assert.match(topicHtml, /先了解运行环境，再尝试部署/);
    assert.ok(topicHtml.includes(`hreflang="en" href="${site}${otherTopic}"`));
    assert.ok(
      (await (await request(otherTopic)).text()).includes(
        `hreflang="zh-Hans" href="${site}${topic}"`,
      ),
    );
    const learningPath = topicHtml.match(
      /<ol class="learning-path[^>]*>.*?<\/ol>/s,
    )?.[0];
    assert.deepEqual(
      [...learningPath.matchAll(/href="([^"]+)"/g)].map((match) => match[1]),
      ["/zh/articles/lesson-2/", zh, "/zh/articles/lesson-1/"],
    );
    for (const [source, target] of [
      ["/topics/", "/zh/topics/"],
      ["/topics/old-edge/", topic],
      ["/zh/topics/old-edge/", topic],
    ]) {
      const response = await request(source);
      assert.equal(response.status, 308, source);
      assert.equal(response.headers.get("location"), target);
    }
    for (const path of [
      "/topics/empty/",
      "/zh/topics/empty/",
      "/topics/missing/",
    ]) {
      assert.equal((await request(path)).status, 404, path);
    }
    const home = await request("/zh/");
    assert.equal(home.headers.get("cache-control"), "no-store");
    const homeHtml = await home.text();
    const latest = homeHtml.match(/<section id="notes".*?<\/section>/s)?.[0];
    assert.equal(
      [...latest.matchAll(/href="\/zh\/articles\/lesson-\d\/"/g)].length,
      6,
    );
    assert.doesNotMatch(latest, /workers-guide/);
    assert.ok(homeHtml.includes(`href="${topic}"`));
    assert.equal(homeHtml.split(`href="${zh}"`).length - 1, 1);
    assert.doesNotMatch(
      homeHtml,
      /Hidden collection|Private draft title|Unpublished edit/,
    );
    const search = await (await request("/zh/search/?q=Workers")).text();
    assert.match(search, /name="robots" content="noindex, follow"/);
    assert.ok(search.includes(`href="${zh}"`));
    assert.doesNotMatch(
      await (await request("/zh/search/?q=%25")).text(),
      /href="\/zh\/articles\/workers-guide\/"/,
    );

    const index = await request("/zh/articles/");
    assert.equal(index.status, 200);
    const links = await index.text();
    assert.ok(links.includes(`href="${zh}"`));
    assert.doesNotMatch(
      links,
      /Private draft title|Unpublished edit|Withdrawn item/,
    );
    const response = await request(zh);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.text();
    assert.match(body, /<h1\b[^>]*>Workers 指南<\/h1>/);
    assert.match(body, /原始 HTML 中可读取这段正文/);
    assert.match(body, /id="section-中文章节"/);
    assert.match(body, /href="#section-中文章节-2"/);
    assert.match(body, /<table>/);
    assert.match(body, /<blockquote>/);
    assert.match(body, /class="hljs-keyword">const/);
    assert.match(
      body,
      /<img[^>]+src="\/goose-placeholder.svg"[^>]+alt="示意图"/,
    );
    assert.match(body, /<a\b[^>]*href="\/zh\/"[^>]*>首页<\/a>/);
    assert.doesNotMatch(
      body,
      /<template>Forbidden|href="javascript:|Never expose draft edits/,
    );
    assert.match(body, /<title>Workers 与 D1 指南<\/title>/);
    assert.match(
      body,
      /name="description" content="Workers 与 D1 整合测试摘要"/,
    );
    assert.ok(body.includes(`rel="canonical" href="${site}${zh}"`));
    assert.ok(body.includes(`hreflang="en" href="${site}${en}"`));
    assert.match(body, /property="og:type" content="article"/);
    assert.match(body, /name="twitter:card" content="summary_large_image"/);
    assert.match(body, /原文作者：测试来源作者/);
    assert.match(body, /href="\/zh\/articles\/lesson-2\/"[^>]*>\s*上一篇/);
    assert.match(body, /href="\/zh\/articles\/lesson-1\/"[^>]*>\s*下一篇/);
    assert.match(body, /href="\/zh\/topics\/edge\/"[^>]*>\s*返回专题/);
    const seo = jsonLd(body);
    assert.equal(seo.BlogPosting.mainEntityOfPage, site + zh);
    assert.equal(seo.BlogPosting.datePublished, "2024-01-01T00:00:00.000Z");
    assert.equal(seo.BlogPosting.dateModified, "2024-01-02T00:00:00.000Z");
    assert.equal(seo.BlogPosting.author, undefined);
    assert.deepEqual(
      seo.BreadcrumbList.itemListElement.map(({ item }) => item),
      [site + "/zh/", site + "/zh/articles/", site + zh],
    );
    const translated = await request(en);
    assert.equal(translated.status, 200);
    const english = await translated.text();
    assert.ok(english.includes(`rel="canonical" href="${site}${en}"`));
    assert.ok(english.includes(`hreflang="zh-Hans" href="${site}${zh}"`));
    assert.match(english, /<title>Reading in a Worker<\/title>/);

    for (const path of [
      "/zh/articles/draft/",
      "/zh/articles/withdrawn/",
      "/zh/articles/missing/",
      "/articles/draft/",
    ]) {
      const missing = await request(path);
      assert.equal(missing.status, 404, path);
      assert.doesNotMatch(
        await missing.text(),
        /Private draft|Never expose|Withdrawn private/,
      );
    }
    for (const [path, destination] of [
      ["/articles/", "/zh/articles/"],
      ["/articles/workers-guide/", zh],
      ["/articles/old-workers/", zh],
      ["/zh/articles/old-workers/", zh],
    ]) {
      const alias = await request(path);
      assert.equal(alias.status, 308, path);
      assert.equal(alias.headers.get("location"), destination);
    }
    for (const path of ["/", "/zh/", "/en/"]) {
      assert.equal((await request(path)).status, 200, path);
    }

    run(wrangler, [
      "d1",
      "execute",
      "CONTENT",
      "--local",
      "--persist-to",
      state,
      "--command",
      "UPDATE content_publications SET is_live = 0 WHERE translation_id = 'guide-en';",
    ]);
    const refreshed = await request(zh);
    assert.match(await refreshed.text(), /原始 HTML 中可读取这段正文/);
    assert.doesNotMatch(await (await request(zh)).text(), /hreflang="en"/);
    assert.equal((await request(en)).status, 404);
    assert.equal((await request(otherTopic)).status, 404);
    assert.equal((await request("/en/topics/")).status, 404);
    assert.doesNotMatch(
      await (await request(topic)).text(),
      /\/en\/topics\/edge-learning\//,
    );
    assert.doesNotMatch(
      await (await request("/en/")).text(),
      /href="\/en\/topics\/"/,
    );
    run(wrangler, [
      "d1",
      "execute",
      "CONTENT",
      "--local",
      "--persist-to",
      state,
      "--command",
      "INSERT INTO content_revision_seals VALUES ('r-draft-edit', 2); UPDATE content_publications SET revision_id = 'r-draft-edit', modified_at_ms = 1704240000000 WHERE translation_id = 'guide-zh';",
    ]);
    assert.match(await (await request(zh)).text(), /Never expose draft edits/);
    assert.ok(
      (await getSitemap()).includes(
        `<loc>${site}${zh}</loc><lastmod>2024-01-03T00:00:00.000Z</lastmod>`,
      ),
    );
    assert.match(await getFeed("zh"), /<title>Unpublished edit<\/title>/);
    assert.doesNotMatch(await getFeed("en"), /<item>/);
    assert.ok(!(await getSitemap()).includes(`${site}${otherTopic}`));
    for (const path of [
      "/zh/",
      "/zh/articles/",
      topic,
      "/zh/search/?q=Unpublished",
    ]) {
      assert.match(
        await (await request(path)).text(),
        /Unpublished edit/,
        path,
      );
    }
    run(wrangler, [
      "d1",
      "execute",
      "CONTENT",
      "--local",
      "--persist-to",
      state,
      "--command",
      "UPDATE content_publications SET is_live = 0 WHERE translation_id = 'guide-zh';",
    ]);
    assert.equal((await request(zh)).status, 404);
    assert.ok(!(await getSitemap()).includes(`${site}${zh}`));
    assert.ok(!(await getFeed("zh")).includes(`${site}${zh}`));
    assert.equal((await request("/zh/articles/old-workers/")).status, 404);
    assert.doesNotMatch(
      await (await request("/zh/articles/")).text(),
      /href="\/zh\/articles\/workers-guide\/"/,
    );

    for (const path of ["/zh/", topic, "/zh/search/?q=Unpublished"]) {
      assert.doesNotMatch(
        await (await request(path)).text(),
        /href="\/zh\/articles\/workers-guide\/"/,
        path,
      );
    }
    run(wrangler, [
      "d1",
      "execute",
      "CONTENT",
      "--local",
      "--persist-to",
      state,
      "--command",
      "INSERT INTO content_publications VALUES ('draft-zh', 'r-draft', 1, 1704326400000, 1704326400000);",
    ]);
    const newlyLive = "/zh/articles/draft/";
    assert.equal((await request(newlyLive)).status, 200);
    assert.ok((await getSitemap()).includes(`${site}${newlyLive}`));
    assert.ok((await getFeed("zh")).includes(`${site}${newlyLive}`));
    for (const path of [
      "/zh/",
      "/zh/articles/",
      topic,
      "/zh/search/?q=Private+draft",
      "/zh/topics/empty/",
    ]) {
      const response = await request(path);
      assert.equal(response.status, 200, path);
      assert.ok((await response.text()).includes(`href="${newlyLive}"`), path);
    }
    assert.equal((await request("/topics/empty/")).status, 308);

    await t.test(
      "unmigrated D1 is a service failure, not a public 404",
      async (failure) => {
        const broken = await worker(failure, join(temp, "unmigrated"));
        for (const path of [zh, "/sitemap.xml", "/zh/rss.xml"]) {
          const response = await broken(path);
          assert.equal(response.status, 503, path);
          assert.equal(await response.text(), "Service unavailable");
        }
      },
    );
  },
);
