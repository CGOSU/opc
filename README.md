# OPC · 独立创作者网站

一个中英文内容网站。仓库使用 pnpm workspaces 管理独立的前端网站与 TypeScript 后端：`apps/web` 为 Astro 内容站，`apps/api` 为 Elysia 服务。双语首页、文章、专题和站内搜索均在 Cloudflare Workers 运行时读取 D1；根路径是独立的静态语言入口。API 是基础骨架，尚未接入数据库、内容服务或后台管理界面。

## 环境

- Node.js `>=22.23.4`
- pnpm `>=12.14.0`

## 安装与本地运行

```sh
pnpm install
pnpm --filter @opc/web run db:migrate:local # 初始化本地 D1
pnpm run dev:web       # Astro 网站，默认 http://localhost:4321
pnpm run dev:api       # Elysia API，默认 http://127.0.0.1:3001
```

`pnpm run db:seed` 是旧的 SQLite 示例快照工具；目标已存在时拒绝覆盖。SQLite 示例数据不会进入 D1，也不再是网站构建或运行的输入。数据库和 SQLite WAL/SHM 文件不得放入 `public/`、静态产物或版本库。

网站与 API 可独立运行、检查和构建。根目录聚合命令：

```sh
pnpm run check          # 两个应用的类型/组件检查
pnpm test               # 两个应用的测试
pnpm run build          # 依次构建网站和 API
pnpm run build:web      # 构建 Astro 页面和 Workers 产物
pnpm run build:api      # 仅构建 TypeScript API
pnpm run preview        # 预览 Astro 构建产物
pnpm run start:api      # 启动已构建 API
```

`apps/api` 使用 Elysia `2.0.0-rc.1` 和 Node 适配器 `@elysia/node` `2.0.0-beta.3`，只监听 loopback 地址 `127.0.0.1`（默认端口 `3001`，可通过 `PORT` 改变）。这两项是按需求固定的预发布版本，并非稳定版。`GET /health` 是存活检查，`/health` 以外的业务路径尚未实现。健康响应不检查数据库，也不代表管理功能已就绪。不要在未配置部署、安全与监听策略前把服务暴露到公网。

## 本地 D1 文章

```sh
pnpm --filter @opc/web run db:migrate:local
pnpm run dev:web
# /zh/articles/ · /en/articles/
```

本地迁移由现有 SQLite SQL 生成，仅去除由 Wrangler 接管的外层事务和 SQLite PRAGMA。本地 D1 与旧 SQLite 快照不共享数据；迁移不导入文章，也不访问云端。空库不会展示示例文章、空专题或虚构项目。重复执行由 Wrangler 迁移记录防止重复应用。

`pnpm --filter @opc/web run test:worker` 构建网站，使用隔离的本地 D1 实际测试 Workers，不往开发库写入测试内容。若 `cover_key` 对应可公开访问的媒体服务，可通过 Workers 环境变量 `CONTENT_ASSET_BASE_URL` 提供其目录 URL；未配置时不猜测封面地址。现有 `source_author` 表示原文作者，不当作本站作者。

## 应用职责

- `apps/web`：Astro 页面和 Workers SSR。`/{locale}/`、`/{locale}/articles/`、`/{locale}/topics/` 及 `/{locale}/search/` 都读取 D1 公开发布数据；专题在当前语言有介绍及公开成员时可访问。搜索支持标题与摘要，不允许索引。动态内容不使用共享缓存；不从浏览器请求数据库，也不依赖 API 服务。
- `apps/api`：独立 Elysia + TypeScript Node.js 服务，依赖 Elysia `2.0.0-rc.1` 与 `@elysia/node` `2.0.0-beta.3`；目前仅有 `/health` 存活端点。无业务 CRUD、认证授权、数据库访问、联系表单或后台管理 UI。
- 根目录 `scripts/seed.mjs`：仅供本地示例环境使用，依次应用根目录 SQL schema，并创建中英文示例首页及站点导航。它不会覆盖已有数据库。
- 根目录 `astro_content_schema.sql`、`astro_site_schema_0002.sql`：SQLite 初始 schema 与增量迁移，路径及顺序属于现有数据契约；不是 API 数据访问层。

前后端当前通过同一仓库下的 workspaces 分开维护，部署和运行可以独立。还没有为它们设计或实现 HTTP 业务契约；不要臆测“前端已调用后端”。未来若新增 API，先定义具体端点、请求/响应结构、鉴权、数据访问及发布快照一致性，再由 `apps/web` 通过明确配置的 URL 调用。

## 内容与上线约定

- 英文和中文使用独立路径。仅对真实存在的译文互相提供语言链接。
- `apps/web/src/data/demo.mjs` 中的内容只是本地预览数据，明确标为示例或概念项目。站名、鹅图、个人介绍、作品和联系方式均待维护者补充。
- 没有已确认的联系方式、项目、工具或隐私政策时，不生成对应目录页。旧首页锚点保留，关于入口指向双语首页的 `#about`。
- `SITE_URL` 是**构建配置**，仅接受无路径、查询或凭据的 HTTP(S) origin。预览不设置它：页面输出 `noindex, follow`，省略绝对 canonical/hreflang，Sitemap 和 RSS 返回 404；`robots.txt` 不禁止抓取，以便爬虫读取 noindex。只在准备公开索引的环境配置真实站点 origin。
- 配置 `SITE_URL` 后，`/sitemap.xml` 和 `/{locale}/rss.xml` 按请求从 D1 生成。文章和专题的 Sitemap `lastmod` 取已发布记录的 `modified_at_ms`，归档/首页没有合适的统一更新时间时不输出 `lastmod`；RSS 按语言最多列 30 篇，`pubDate` 取首次发布日期。不收录草稿、撤稿、别名及 noindex 内容。
- 本仓库的 Wrangler 配置仅用于本地开发；未配置远端 D1、生产密钥、CI/CD 或后台管理界面。根目录 [`设计.md`](设计.md) 与 [`架构.md`](架构.md) 说明设计方向及后续目标；尚未实现的规划不能当成现有能力。

## 页面与搜索意图

| 规范 URL | 主要搜索意图 |
| --- | --- |
| `/{locale}/` | 品牌与技术主题总览：Web 开发、云服务部署和 AI 应用实践 |
| `/{locale}/articles/` | 浏览已发布教程与工程笔记，不承接某一篇教程的关键词 |
| `/{locale}/articles/{slug}/` | 解决一个具体工程问题，以真实标题与摘要区分长尾意图 |
| `/{locale}/topics/`、`/{locale}/topics/{slug}/` | 浏览技术领域及学习路径；从专题页链接到具体教程，不复制正文 |
| `/{locale}/search/` | 站内查找，不允许索引 |
| `/{locale}/#about` | 了解站点，不作为独立索引页 |

`locale` 为 `zh` 或 `en`。根路径仍是语言入口。无前缀文章/专题入口在有对应中文页面时直接 308 到规范地址；仅使用表中登记的真实历史别名，无多跳或重复正文。未发布、撤稿、无对应规范地址返回 404。没有已知的生产文章 URL 清单，不批量猜测重定向。正式内容导入后，应以真实标题、摘要和搜索查询审查重叠：相同问题优先更新一篇主文，不同问题拆分意图并互链。没有公开项目/工具资料时不创建产品目标页。

## D1 数据与发布约定

- 本地迁移复用根目录两份 SQL；已应用的迁移不回写，后续变化用独立增量迁移。保留旧 SQLite 文件和一致性备份。正式数据若来自旧 SQLite，先核对备份的约束、模式、语言、路由和发布指针，再在隔离库演练导入与计数比对；本项目不会自动导入或双写。
- 文章字段映射到现有数据：Slug 取规范路由，正文和 SEO 字段取对应封存的修订，访问状态取发布指针及 `is_live`，日期取 `first_published_at_ms` 和 `modified_at_ms`。不需要重建文章表，也没有新增后台。发布由未来确认的写入方按 SQL 约束执行：新增修订并写入关联数据，封存后更新发布指针；更新保留首次发布日期；撤稿设 `is_live = 0`，不删除源修订。版本回退使用仍有效的旧封存修订并按真实变更时间更新指针。
- 远程预发布前另行确认数据来源、D1 绑定、导入和写入职责。用独立测试库先验证迁移、规范域名、索引开关、HTTP 308/404/5xx、英文/中文互链以及撤稿后 HTML、Sitemap 和 RSS 的表现，再决定是否上生产。动态响应目前用 `no-store`，预发布需确认 CDN 规则未覆盖它。发生问题时可回滚兼容的 Worker 版本；若涉及数据迁移，使用已验证的备份/恢复方案，不在生产库执行破坏性反向操作。

## 视觉设计

首页依照 [`设计.md`](设计.md) 实现：明亮克制的青灰配色、像素鹅占位、桌面内容网格、适配手机的布局和导航。插画表达属于概念视觉，不代表真实作品。
