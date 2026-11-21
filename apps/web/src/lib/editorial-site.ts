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
    home: "首页",
    eyebrow: "WEB · CLOUDFLARE · AI 实践",
    allArticles: "全部文章",
    allTopics: "全部专题",
    readMore: "阅读详情",
    openTopic: "进入专题",
    articleBadge: "技术文章",
    topicBadge: "学习路径",
    practiceBadge: "精选实践",
    latestSub: "按发布日期整理的技术教程与可复现工程笔记，支持横向滑动浏览。",
    heroStickers: [
      { value: "Astro + D1", label: "边缘按需渲染" },
      { value: "ZH / EN", label: "双语独立路径" },
      { value: "Workers", label: "零冗余架构" },
    ],
    marquee: [
      "现代 Web 开发",
      "Cloudflare Workers",
      "D1 内容引擎",
      "AI 应用实践",
      "双语技术 SEO",
      "可复现工程笔记",
    ],
    focusTitle: "核心关注与工程原则",
    focusSub: "以真实开发问题为起点，沉淀清晰、稳定、可验证的技术方案。",
    focusPoints: [
      {
        icon: "rocket" as const,
        tone: "sky" as const,
        tag: "前端架构",
        title: "现代 Web 开发",
        desc: "以 Astro、TypeScript 与语义化 HTML 构建轻量、高可访问性的内容与应用。",
      },
      {
        icon: "shield" as const,
        tone: "mint" as const,
        tag: "边缘部署",
        title: "Cloudflare 与 D1",
        desc: "在 Workers 运行时直接读取封存快照，保证发布一致性与稳定响应。",
      },
      {
        icon: "gauge" as const,
        tone: "sun" as const,
        tag: "工程效率",
        title: "AI 应用开发实践",
        desc: "记录 AI 工具接入、自动化工作流与内容创作中的实测取舍。",
      },
      {
        icon: "uptime" as const,
        tone: "grape" as const,
        tag: "技术 SEO",
        title: "双语与结构化发布",
        desc: "独立语言 URL、精准 hreflang、Sitemap 与 RSS，不生成虚假译文。",
      },
    ],
    globeTitle: "边缘网络示意",
    globeSub: "可拖拽旋转的交互式节点地球，示意全球边缘分发与双语内容触达。",
    globeHint: "拖拽旋转地球",
    aboutTabs: {
      about: "关于本站",
      scope: "内容方向",
      work: "项目与联系",
    },
    aboutScopeLead: "本站持续围绕以下三个方向输出结构化教程与实操记录：",
    aboutScopeItems: [
      "Web 开发：前端架构、语义化组件、响应式排版与性能调优。",
      "云服务与边缘运行：Cloudflare Workers、D1 数据建模、迁移与发布一致性。",
      "AI 应用实践：开发辅助工具、媒体工作流与独立产品原型探索。",
    ],
    contactEmptyNote:
      "当前尚未公开联系方式或在线表单；待正式信息确认后再行开放。",
    footerContentHeading: "内容导航",
    footerResourceHeading: "语言与订阅",
    footerNoteHeading: "关于与说明",
    footerNote:
      "双语内容由 Astro + Cloudflare Workers 按需渲染，所有公开文章与专题均读取自 D1 封存快照。",
    quickSearch: "快速搜索",
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
    home: "Home",
    eyebrow: "WEB · CLOUDFLARE · AI PRACTICE",
    allArticles: "All articles",
    allTopics: "All topics",
    readMore: "Read more",
    openTopic: "Open topic",
    articleBadge: "Article",
    topicBadge: "Learning path",
    practiceBadge: "Featured",
    latestSub:
      "Recently published tutorials and reproducible engineering notes. Swipe or scroll horizontally to explore.",
    heroStickers: [
      { value: "Astro + D1", label: "Edge SSR" },
      { value: "ZH / EN", label: "Bilingual URLs" },
      { value: "Workers", label: "Clean Stack" },
    ],
    marquee: [
      "Modern Web Dev",
      "Cloudflare Workers",
      "D1 Content Engine",
      "AI Applications",
      "Bilingual Tech SEO",
      "Reproducible Notes",
    ],
    focusTitle: "Focus areas & principles",
    focusSub:
      "Starting from real engineering problems to document clear, verifiable approaches.",
    focusPoints: [
      {
        icon: "rocket" as const,
        tone: "sky" as const,
        tag: "Architecture",
        title: "Modern Web Dev",
        desc: "Lightweight, accessible apps and publications built with Astro, TypeScript, and semantic HTML.",
      },
      {
        icon: "shield" as const,
        tone: "mint" as const,
        tag: "Edge Runtime",
        title: "Cloudflare & D1",
        desc: "On-demand Workers rendering backed by sealed D1 revisions for predictable publishing.",
      },
      {
        icon: "gauge" as const,
        tone: "sun" as const,
        tag: "Workflows",
        title: "AI Engineering",
        desc: "Practical notes on AI tooling, media workflows, and trade-offs from hands-on experiments.",
      },
      {
        icon: "uptime" as const,
        tone: "grape" as const,
        tag: "Technical SEO",
        title: "Bilingual Publishing",
        desc: "Dedicated locale routes, accurate hreflang links, sitemaps, and RSS without fake translations.",
      },
    ],
    globeTitle: "Edge topology sketch",
    globeSub:
      "Drag to spin this orthographic globe illustrating edge delivery and bilingual reach.",
    globeHint: "Drag to rotate",
    aboutTabs: {
      about: "About",
      scope: "Scope",
      work: "Work & Contact",
    },
    aboutScopeLead:
      "Editorial writing and hands-on documentation center on three areas:",
    aboutScopeItems: [
      "Web development: architecture, semantic components, responsive layout, and performance.",
      "Cloud & edge delivery: Cloudflare Workers, D1 schema design, migrations, and sealed releases.",
      "AI applications: practical developer tools, content pipelines, and independent prototypes.",
    ],
    contactEmptyNote:
      "No public contact channels or forms are published yet; they will appear here once confirmed.",
    footerContentHeading: "Navigation",
    footerResourceHeading: "Locale & Feeds",
    footerNoteHeading: "Colophon",
    footerNote:
      "Rendered on demand with Astro and Cloudflare Workers from sealed D1 snapshots.",
    quickSearch: "Quick search",
  },
};

export function editorialCopy(locale: Locale) {
  return copy[locale];
}

export const publishedHomeIndexPolicy = `
  SELECT locale, noindex FROM published_content
  WHERE route_path = '/' AND template_key = 'home' AND locale IN ('zh', 'en')
`;

export async function editorialMetadata(db: D1Database, locale: Locale) {
  const site = await db
    .prepare(
      "SELECT site_name, default_description FROM public_site_metadata WHERE locale = ?",
    )
    .bind(locale)
    .first<{ site_name: string | null; default_description: string | null }>();
  return {
    name: site?.site_name ?? editorialCopy(locale).name,
    defaultDescription: site?.default_description ?? undefined,
  };
}

export async function loadEditorialSite(db: D1Database, locale: Locale) {
  const [metadata, topics] = await Promise.all([
    editorialMetadata(db, locale),
    listTopics(db, locale, 6),
  ]);
  const c = editorialCopy(locale);
  return {
    ...metadata,
    topics,
    menu: [
      { label: c.articles, href: articlesPath(locale) },
      ...(topics.length ? [{ label: c.topics, href: topicsPath(locale) }] : []),
      { label: c.about, href: `/${locale}/#about` },
      { label: c.search, href: `/${locale}/search/` },
    ],
  };
}
