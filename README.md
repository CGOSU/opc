# OPC · 独立创作者网站

一个中英文内容网站。仓库使用 Bun Workspaces：`apps/web` 为 Astro 内容站，`apps/admin` 为 React 管理后台，`apps/api` 为 Elysia Worker，`packages/db` 提供服务端 Drizzle D1 连接。双语首页、文章、专题和站内搜索均在 Cloudflare Workers 运行时读取 D1；根路径是独立的静态语言入口。后台支持单管理员登录与退出、工作台、文章/专题/分类/标签管理、只读账户信息和双语站点基本设置。

## 环境

- Node.js `>=22.23.4`
- Bun `1.4.4`（包管理与脚本入口；Worker 业务不依赖 Bun 运行时）

## 安装与本地运行

```sh
bun install --frozen-lockfile
bun run db:migrate:local # 初始化本地 D1
bun run dev:web          # Astro 网站，默认 http://localhost:4321
bun run dev:api          # Elysia Worker，默认 http://127.0.0.1:3001
```

`bun run db:seed` 是旧的 SQLite 示例快照工具；目标已存在时拒绝覆盖。SQLite 示例数据不会进入 D1，也不再是网站构建或运行的输入。数据库和 SQLite WAL/SHM 文件不得放入 `public/`、静态产物或版本库。

网站、API 与后台可分别检查和构建。根目录命令：

```sh
bun run check          # 严格类型、未使用符号、switch 分支与 Astro 诊断
bun run test           # Astro 单元测试与 API 的 Wrangler/workerd 集成测试
bun run build          # 依次构建网站、API Worker 和后台
bun run build:web      # 构建 Astro 页面和 Worker 产物
bun run build:api      # Wrangler deploy --dry-run，仅验证打包和绑定配置
bun run build:admin    # 仅构建 React 后台
bun run build:admin-worker # 构建 React 并 dry run 同源 Admin/API Worker
bun run preview        # 预览 Astro 构建产物
bun run preview:admin  # 预览同源 Admin/API Worker（先构建 Admin）
```

### Elysia Worker 兼容性

- 阶段 A 选用 [Elysia 1.4.32](https://registry.npmjs.org/elysia/1.4.32)（核对时的 [latest](https://registry.npmjs.org/elysia/latest) 稳定版）与 [Eden 1.4.9](https://registry.npmjs.org/@elysiajs%2feden/1.4.9)（peer 要求 Elysia `>=1.4.19`），使用 Drizzle ORM `0.45.4` 和 Wrangler `4.165.0`。
- 按 [Elysia 官方 Workers 指南](https://elysiajs.com/integrations/cloudflare-worker.html) 使用实验性的 `CloudflareAdapter`，导出前调用 `.compile()`，避免在启动时构造内联 `Response`。API Worker 使用 `2026-11-01` 兼容日期（要求不早于 `2025-06-01`），当前不需要 `nodejs_compat`。
- `bun run --filter @opc/api test` 在隔离的本地 D1 应用全部迁移，通过 Eden 发起 HTTP 请求，验证实际 D1 读写、请求/响应校验、认证生命周期及分类和标签的约束。数据库探针仅存在于测试入口，不进入正式 Worker。`GET /health` 仅检查存活，不检查 D1 或业务就绪状态。
- `bun run build:api` 在本地生成 `apps/api/dist`；配置中的 D1 ID 仅供本地使用。Dry run 不验证远端资源，不执行部署。

## 本地管理员

在仓库根目录执行：

```sh
bun run db:migrate:local
bun run admin:create:local <username> # 在终端遮蔽输入密码
bun run dev:api                     # 终端一
bun run dev:admin                   # 终端二
```

打开 `http://localhost:5173`（不要替换成 `127.0.0.1`）。Vite 同源代理 `/api`；本地 Chromium 接受 localhost 上的 Secure Cookie。初始化只写本地 D1，不会覆盖现有管理员。隔离测试可指定 `--persist-to PATH`；自动化用 `--password-stdin` 接收原始 UTF-8 输入，不剥除末尾换行。不要将密码传入命令行参数、日志或仓库。

使用 `bun run build:admin-worker` 后运行 `bun run preview:admin`，打开 [http://localhost:3002](http://localhost:3002) 登录。进入「文章管理」后可分别保存当前语言和共享设置；已有中英文版本可从编辑页切换，缺失的版本可显式添加。Wrangler 在同一来源提供 SPA 与 Elysia API：页面路径回退到 SPA 入口，`/api/*` 与 `/health` 始终由 API 处理。该预览使用同一个本地 D1，但与 Vite 的端口不同，登录 API 会检查对应的精确 Origin；不是生产部署配置。

认证使用 Workers 原生 [Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/) 的 PBKDF2-HMAC-SHA-256（100,000 次，128-bit 随机盐，256-bit 派生值），并在 workerd 中验证。首版选用原生 PBKDF2，不依赖未经目标环境验证的 Argon2id/WASM 实现。哈希包含算法与迭代次数；升级时先验证新方案的生产 CPU 开销，再保留旧格式读取，在成功验证旧密码后重哈希，或通过受控方式重置。Cloudflare 免费套餐的生产请求 CPU 预算仍待目标环境验证，本地 workerd 不代表生产配额。

Session 固定有效 8 小时，D1 只存 Token 的 SHA-256，注销删除服务端记录。有效格式的登录请求每来源 IP 每 5 分钟最多 8 次（无可信 IP 时共享桶），上限和过期均由 D1 原子处理。新增管理路由应挂载 `adminSecurity`，除登录外声明 `requireSession: true`；写请求须包含与 `ADMIN_ORIGIN` 完全一致的 `Origin` 及 `X-OPC-CSRF: 1`。生产须从同一 HTTPS origin 提供后台和管理 API，设置准确的 `ADMIN_ORIGIN`；远端管理员初始化及发布配置未在本阶段执行。

## 分类与标签

运行 `bun run db:migrate:local` 应用 `0009_taxonomy_translations.sql` 后，后台 `/categories` 和 `/tags` 按共享实体展示，可按语言状态筛选。中英文名称、Slug、描述与 SEO 独立保存（新增用 `POST /:id/translations/:locale`，更新用 `PUT /:id/translations/:locale` 并带 `revision`）；排序值用 `PATCH /:id/settings` 独立保存。没有翻译时不会生成该语言的新路径。已存在的无语言文案和地址保留为历史内容，不算作翻译。有文章关联的分类不可删除；删除标签会清理关联，不会删除文章。

后台 `/posts` 管理已发布文章。应用 `0008_post_translations.sql` 后，编辑页分别提供「保存当前语言」和「保存共享设置」。当前语言保存标题、Slug、摘要、Markdown 和 SEO；文章设置保存分类、标签、专题和共享封面。修改 Slug 后同语言原地址继续跳转。删除只移除所选语言的当前内容和地址，不影响另一语言或归档快照；导航或策划专题要求的版本须解除引用后才能删除。迁移不会让未发布或撤下的版本重新公开。

前台保留 `/{locale}/articles/{slug}/`，新增 `/{locale}/categories/{slug}/` 和 `/{locale}/tags/{slug}/`。API 和 Astro 从同一个 D1 读取已发布内容，无需重新构建。构建管理后台时用 `VITE_PUBLIC_SITE_ORIGIN` 设置“前台”链接的来源，默认用于本地开发的 `http://localhost:4321`。公开文章详情 API 接受 `?locale=zh|en`（默认中文）。

后台 `/topics` 管理新建专题，应用 `0006_topics.sql` 后可搜索并添加文章、拖拽或用键盘排序，保存后立即在 `/{locale}/topics/{slug}/` 和公开专题 API 生效。专题信息在两种语言共用，文章按访问语言显示并沿用同一顺序。关系附着于双语文章的共享身份，仅删除最后一个语言版本时解除关联。既有编辑专题及其历史 URL 保留，不由新专题编辑器改写。

后台 `/` 是工作台。文章以共享内容身份计数，最近更新列表取每篇文章最近更新的语言版本；专题统计限后台可管理的专题。四项统计和两份最近列表直接读取 D1，无需重建站点。

`/session` 只显示当前管理员账户；不提供用户名或密码编辑。`/settings` 使用 `0007_site_settings.sql`（由 `bun run db:migrate:local` 应用）独立保存中英文站名和默认 SEO 描述，不改动历史站点快照。设置即时影响对应语言的首页元数据、公共页眉/页脚站名和 RSS；文章和专题优先使用自己的 SEO 描述或摘要，均缺失时才使用站点默认描述。留空沿用原有默认值。域名、导航和密钥不在后台配置。

文章的分类、标签和专题关系使用 `posts.id`（沿用原内容 ID），不自动归类已有文章。管理后台的关联数量链接可打开筛选后的文章列表。

## 本地 D1 文章

```sh
bun run db:migrate:local
bun run dev:web
# /zh/articles/ · /en/articles/
```

本地迁移由现有 SQLite SQL 生成，仅去除由 Wrangler 接管的外层事务和 SQLite PRAGMA。本地 D1 与旧 SQLite 快照不共享数据；迁移不导入文章，也不访问云端。空库不会展示示例文章、空专题或虚构项目。重复执行由 Wrangler 迁移记录防止重复应用。Astro 和 API 的本地 `CONTENT` 绑定共享 `apps/web/.wrangler/state`。增量迁移使用新的 SQL 文件和名称，并在 `apps/web/scripts/prepare-d1.mjs` 中注册；不要覆盖已应用的迁移。

`bun run --filter @opc/web test:worker` 构建网站，使用隔离的本地 D1 实际测试 Workers，不往开发库写入测试内容。若 `cover_key` 对应可公开访问的媒体服务，可通过 Workers 环境变量 `CONTENT_ASSET_BASE_URL` 提供其目录 URL；未配置时不猜测封面地址。现有 `source_author` 表示原文作者，不当作本站作者。

## 应用职责

- `apps/web`：Astro 页面和 Workers SSR。`/{locale}/`、`/{locale}/articles/`、`/{locale}/topics/` 及 `/{locale}/search/` 都读取 D1 公开发布数据；专题在当前语言有介绍及公开成员时可访问。搜索支持标题与摘要，不允许索引。动态内容不使用共享缓存；不从浏览器请求数据库，也不依赖 API 服务。
- `apps/admin`：React 管理后台，通过 Eden Treaty 和 TanStack Query 消费同源管理 API。
- `apps/api`：Elysia Worker，提供 `/health`、`/api/admin` 管理接口及 `/api/public` 公开内容查询。
- `packages/db`：Drizzle D1 连接与服务端数据访问，不进入浏览器产物。
- 根目录 `scripts/seed.mjs`：仅供本地示例环境使用，依次应用 `packages/db/migrations/` 下的基础 SQL schema，并创建中英文示例首页及站点导航。它不会覆盖已有数据库。
- `packages/db/migrations/` 下的 `astro_content_schema.sql` 与 `astro_*_schema_000*.sql`：SQLite 初始 schema 与增量迁移。D1 迁移顺序由 `apps/web/scripts/prepare-d1.mjs` 显式注册。

Astro 与 API Worker 可独立构建和运行。Astro 现有公开页面仍在服务端直接读取 D1，不经管理 API。

## 发布前验证与环境配置

- [`.env.example`](.env.example) 列出公开构建变量。从仓库根目录执行 `cp .env.example .env`，按环境编辑后执行 `set -a; . ./.env; set +a`，再运行构建；不复制真实凭据。改动 `SITE_URL` 或 `VITE_PUBLIC_SITE_ORIGIN` 后须重新构建对应应用。
- 本地构建使用 `bun run build`。Astro 产物在 `apps/web/dist/`，React 静态资源在 `apps/admin/dist/`，Elysia dry-run 产物在 `apps/api/dist/`。使用 `bun run preview` 与 `bun run preview:admin` 分别预览；管理后台与管理 API 必须同源。
- 发布配置应从 `apps/web/wrangler.jsonc` 和 `apps/api/wrangler.jsonc` 单独派生。Web 与 Admin Worker 的 `CONTENT` 必须指向同一个经核实的环境 D1；Admin 使用 `admin-preview` 的资产路由规则作为模板，将 `ADMIN_ORIGIN` 设为实际管理后台 HTTPS origin（无末尾斜杠）。不要把示例数据库 ID、localhost 配置或本地账户用于远端。
- 在目标环境接入前，备份并核对旧库和迁移记录；先执行 `node apps/web/scripts/prepare-d1.mjs` 生成迁移，再在隔离目标库验证依序应用 `0001`–`0009`。仓库的管理员初始化命令仅支持本地；远端账户初始化、迁移或部署须另行获准。可选 `CONTENT_ASSET_BASE_URL` 是 Astro Worker 读取历史 `cover_key` 资源的运行时变量。后台文章与专题封面图支持外部 URL 与本地图片上传（通过 API Worker 的 R2 `MEDIA` 绑定存储，本地开发绑定 `opc-media-local` 并随 `--persist-to` 持久化在 `apps/web/.wrangler/state`；生产可配置公开资源域名变量 `MEDIA_PUBLIC_BASE_URL`，未配置时回退至同源 `/api/public/media/covers/...` 读取接口）。
- 本地验收命令：`bun run check`、`WRANGLER_SEND_METRICS=false bun run test`、`WRANGLER_SEND_METRICS=false bun run --filter @opc/web test:worker` 和 `WRANGLER_SEND_METRICS=false bun run build`。Vitest 和 Astro Worker 集成使用独立的迁移状态；不要用日常开发库复用测试数据。
- 本次本地浏览器验收使用两个 Worker 共享同一隔离 D1：登录后新建分类、标签及双语文章，检查保存失败后保留输入、刷新筛选、历史地址跳转、专题键盘/鼠标排序，以及永久删除一个语言版本后另一版本仍公开可读。检查了桌面与 375px 窄屏、抽屉的键盘打开/关闭和焦点恢复；不等同完整无障碍或多浏览器认证。
- 已知边界：生产 D1/R2 绑定、Cloudflare 免费套餐 CPU 和真实域名/缓存尚未验证；旧站导航与已封存的历史专题不在本期编辑范围。不提供草稿、回收站或发布回退。

## 内容与上线约定

- 英文和中文使用独立路径。仅对真实存在的译文互相提供语言链接。
- `apps/web/src/data/demo.mjs` 中的内容只是本地预览数据，明确标为示例或概念项目。站名、鹅图、个人介绍、作品和联系方式均待维护者补充。
- 没有已确认的联系方式、项目、工具或隐私政策时，不生成对应目录页。旧首页锚点保留，关于入口指向双语首页的 `#about`。
- `SITE_URL` 是**构建配置**，仅接受无路径、查询或凭据的 HTTP(S) origin。预览不设置它：页面输出 `noindex, follow`，省略绝对 canonical/hreflang，Sitemap 和 RSS 返回 404；`robots.txt` 不禁止抓取，以便爬虫读取 noindex。只在准备公开索引的环境配置真实站点 origin。
- 配置 `SITE_URL` 后，`/sitemap.xml` 和 `/{locale}/rss.xml` 按请求从 D1 生成。文章和专题的 Sitemap `lastmod` 取已发布记录的 `modified_at_ms`，归档/首页没有合适的统一更新时间时不输出 `lastmod`；RSS 按语言最多列 30 篇，`pubDate` 取首次发布日期。不收录草稿、撤稿、别名及 noindex 内容。
- 本仓库的 Wrangler 配置仅用于本地开发；未配置远端 D1、生产密钥或 CI/CD。[docs/设计.md](docs/设计.md) 与 [docs/架构.md](docs/架构.md) 说明设计方向及后续目标；尚未实现的规划不能当成现有能力。

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

- 本地迁移按顺序应用 `packages/db/migrations/` 中登记的 SQL；已应用的迁移不回写，后续变化用独立增量迁移。保留旧 SQLite 文件和一致性备份。正式数据若来自旧 SQLite，先核对备份的约束、模式、语言、路由和发布指针，再在隔离库演练导入与计数比对；本项目不会自动导入或双写。
- 文章由 `posts`、`post_translations` 和关联表管理。迁移从现有发布指针（包括撤下的版本）提取当前内容；从未发布的语言保留已有草稿，不生成空翻译。旧封存修订仅归档，保存不再生成完整快照。撤稿和回退不在后台编辑范围。
- `GET /api/admin/posts/:postId/translations/:locale` 回传 `revision`；`PUT` 必须带该字段，只更新指定语言。译文已变更或不存在时返回 `409`，不会覆盖或隐式创建；添加语言请用该路径的 `POST`。冲突时后台保留当前草稿，由编辑者决定是否放弃它并读取最新版本。`PATCH /api/admin/posts/:postId/settings` 仅更新请求中给出的共享字段，整次写入成功或回滚。
- 迁移 `0008` 到 `0010` 分别拆分文章、分类/标签和专题的主表、翻译与关系。旧的无语言分类、标签和专题保留原地址及公共文案，但不当作中英文译文。
- 远程预发布前另行确认数据来源、D1 绑定、导入和写入职责。用独立测试库先验证迁移、规范域名、索引开关、HTTP 308/404/5xx、英文/中文互链以及撤稿后 HTML、Sitemap 和 RSS 的表现，再决定是否上生产。动态响应目前用 `no-store`，预发布需确认 CDN 规则未覆盖它。发生问题时可回滚兼容的 Worker 版本；若涉及数据迁移，使用已验证的备份/恢复方案，不在生产库执行破坏性反向操作。

## 视觉设计

首页依照 [docs/设计.md](docs/设计.md) 实现：明亮克制的青灰配色、像素鹅占位、桌面内容网格、适配手机的布局和导航。插画表达属于概念视觉，不代表真实作品。
