import type { D1Database } from "@cloudflare/workers-types/index.ts";
import type { Locale } from "./home";
import { articlesPath } from "./articles";
import { listTopics, topicsPath } from "./topics";

const copy = {
  zh: {
    name: "技术实践",
    title: "Web 开发教程与技术实践",
    heading: ["Web 开发教程与", "软件工程实践"],
    description:
      "分享现代 Web 开发、Cloudflare 云服务与 AI 应用开发的技术教程、实战经验和工程解决方案。",
    latest: "最新技术文章",
    archive: "浏览技术文章",
    articles: "技术文章",
    topicHeading: "Web 开发与技术专题",
    topics: "技术专题",
    topicIntro: "按主题梳理核心概念、学习顺序与可复现的实战教程。",
    practice: "开发实践与问题解决",
    practiceIntro: "从实际问题出发，记录相关的工程取舍与解决办法。",
    emptyWork: "本站暂无公开的项目和工具条目。",
    about: "关于本站",
    aboutIntro:
      "本站以技术教程与工程实践为主，关注 Web 开发、云服务部署和 AI 应用开发。记录可复现的经验、技术取舍和解决方案。",
    search: "搜索",
    skip: "跳到主要内容",
    menu: "打开菜单",
    close: "关闭菜单",
    lang: "语言",
    footerNav: "页脚导航",
    back: "返回顶部",
    empty: "暂未发布技术文章。",
  },
  en: {
    name: "Engineering Notes",
    title: "Web Development Tutorials and Engineering Notes",
    heading: ["Web development tutorials", "and engineering practice"],
    description:
      "Tutorials and practical notes on modern web development, deploying with Cloudflare, and building AI applications.",
    latest: "Latest technical articles",
    archive: "Browse articles",
    articles: "Articles",
    topicHeading: "Web development topics",
    topics: "Topics",
    topicIntro:
      "Follow a learning path from core concepts to practical tutorials.",
    practice: "Engineering practice and troubleshooting",
    practiceIntro:
      "Explore real development problems, trade-offs, and solutions.",
    emptyWork: "No projects or tools have been published on this site yet.",
    about: "About this site",
    aboutIntro:
      "This site focuses on technical tutorials and engineering practice in web development, cloud deployment, and AI applications. It documents reproducible approaches and the trade-offs behind them.",
    search: "Search",
    skip: "Skip to content",
    menu: "Open menu",
    close: "Close menu",
    lang: "Language",
    footerNav: "Footer navigation",
    back: "Back to top",
    empty: "No technical articles have been published yet.",
  },
};

export function editorialCopy(locale: Locale) {
  return copy[locale];
}

export const publishedHomeIndexPolicy = `
  SELECT locale, noindex FROM published_content
  WHERE route_path = '/' AND template_key = 'home' AND locale IN ('zh', 'en')
`;

export async function editorialSiteName(db: D1Database, locale: Locale) {
  const site = await db
    .prepare("SELECT site_name FROM published_site WHERE locale = ?")
    .bind(locale)
    .first<string>("site_name");
  return site?.trim() || editorialCopy(locale).name;
}

export async function loadEditorialSite(db: D1Database, locale: Locale) {
  const [name, topics] = await Promise.all([
    editorialSiteName(db, locale),
    listTopics(db, locale, 6),
  ]);
  const c = editorialCopy(locale);
  return {
    name,
    topics,
    menu: [
      { label: c.articles, href: articlesPath(locale) },
      ...(topics.length ? [{ label: c.topics, href: topicsPath(locale) }] : []),
      { label: c.about, href: `/${locale}/#about` },
      { label: c.search, href: `/${locale}/search/` },
    ],
  };
}
