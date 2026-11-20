import type { D1Database } from "@cloudflare/workers-types/index.ts";
import { articlesPath, publicSlugRoute } from "./articles";
import {
  editorialCopy,
  editorialSiteName,
  publishedHomeIndexPolicy,
} from "./editorial-site";
import type { Locale } from "./home";
import { listTopicDiscovery, topicsPath } from "./topics";

const locales = ["zh", "en"] as const;
const eligibleArticles = `
  FROM published_articles
  WHERE locale IN ('zh', 'en') AND noindex = 0
    AND ${publicSlugRoute("route_path", "articles")}
`;

function escapeXml(value: string) {
  return value
    .replace(
      /[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu,
      "",
    )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xml(body: string, type: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}\n`, {
    headers: {
      "Content-Type": `${type}; charset=utf-8`,
      "Cache-Control": "no-store",
    },
  });
}

export function discoveryUnavailableInPreview() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function sitemap(db: D1Database, site: URL) {
  const [homes, topics, articles] = await Promise.all([
    db
      .prepare(publishedHomeIndexPolicy)
      .all<{ locale: Locale; noindex: 0 | 1 }>(),
    listTopicDiscovery(db),
    db
      .prepare(`SELECT path, modified_at_ms ${eligibleArticles} ORDER BY path`)
      .all<{ path: string; modified_at_ms: number }>(),
  ]);
  const entries: { path: string; modified_at_ms?: number }[] = [];
  for (const locale of locales) {
    if (
      !homes.results.some(
        (home) => home.locale === locale && home.noindex === 1,
      )
    ) {
      entries.push({ path: `/${locale}/` });
    }
    entries.push({ path: articlesPath(locale) });
    if (topics.some((topic) => topic.locale === locale))
      entries.push({ path: topicsPath(locale) });
  }
  entries.push(
    ...topics.filter((topic) => topic.noindex === 0),
    ...articles.results,
  );
  const urls = entries.map(({ path, modified_at_ms }) => {
    const loc = escapeXml(new URL(path, site).href);
    const lastmod =
      modified_at_ms === undefined
        ? ""
        : `<lastmod>${new Date(modified_at_ms).toISOString()}</lastmod>`;
    return `  <url><loc>${loc}</loc>${lastmod}</url>`;
  });
  return xml(
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`,
    "application/xml",
  );
}

export async function articleFeed(db: D1Database, site: URL, locale: Locale) {
  const [name, { results }] = await Promise.all([
    editorialSiteName(db, locale),
    db
      .prepare(
        `
      SELECT path, title, summary, first_published_at_ms
      ${eligibleArticles} AND locale = ?
      ORDER BY first_published_at_ms DESC, path
      LIMIT 30
    `,
      )
      .bind(locale)
      .all<{
        path: string;
        title: string;
        summary: string;
        first_published_at_ms: number;
      }>(),
  ]);
  const archive = escapeXml(new URL(articlesPath(locale), site).href);
  const self = escapeXml(new URL(`/${locale}/rss.xml`, site).href);
  const items = results.map((article) => {
    const url = escapeXml(new URL(article.path, site).href);
    const date = new Date(article.first_published_at_ms).toUTCString();
    return `    <item><title>${escapeXml(article.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><description>${escapeXml(article.summary)}</description><pubDate>${date}</pubDate></item>`;
  });
  return xml(
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(name)}</title>
    <link>${archive}</link>
    <description>${escapeXml(editorialCopy(locale).description)}</description>
    <language>${locale === "zh" ? "zh-CN" : "en"}</language>
    <atom:link rel="self" type="application/rss+xml" href="${self}" />
${items.join("\n")}
  </channel>
</rss>`,
    "application/rss+xml",
  );
}
