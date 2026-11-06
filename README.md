# OPC · 独立创作者网站

一个中英文内容网站。仓库使用 pnpm workspaces 管理独立的前端网站与 TypeScript 后端：`apps/web` 为 Astro 静态站点，`apps/api` 为 Elysia 服务。SQLite 目前只在网站构建期间被只读读取；API 是基础骨架，尚未接入数据库、内容服务或后台管理界面。

## 环境

- Node.js `>=22.23.4`
- pnpm `>=12.14.0`

## 安装与本地运行

```sh
pnpm install
pnpm run db:seed       # 仅在尚无 data/content.sqlite 时初始化示例快照
pnpm run dev:web       # Astro 网站，默认 http://localhost:4321
pnpm run dev:api       # Elysia API，默认 http://127.0.0.1:3001
```

`pnpm run db:seed` 创建本地示例数据库；目标数据库已存在时拒绝覆盖。网站默认需要仓库根目录下的 `data/content.sqlite`。可选 `CONTENT_DB` 覆盖它：相对路径以仓库根目录为基准，绝对路径原样使用。未设置时也不能推测或自动创建数据库；缺失、未发布或损坏的快照会使网站构建失败。数据库和 SQLite WAL/SHM 文件不得放入 `public/`、静态产物或版本库。

网站与 API 可独立运行、检查和构建。根目录聚合命令：

```sh
pnpm run check          # 两个应用的类型/组件检查
pnpm test               # 两个应用的测试
pnpm run build          # 依次构建网站和 API
pnpm run build:web      # 仅构建 Astro 静态站
pnpm run build:api      # 仅构建 TypeScript API
pnpm run preview        # 预览 Astro 构建产物
pnpm run start:api      # 启动已构建 API
```

`apps/api` 使用 Elysia `2.0.0-rc.1` 和 Node 适配器 `@elysia/node` `2.0.0-beta.3`，只监听 loopback 地址 `127.0.0.1`（默认端口 `3001`，可通过 `PORT` 改变）。这两项是按需求固定的预发布版本，并非稳定版。`GET /health` 是存活检查，`/health` 以外的业务路径尚未实现。健康响应不检查数据库，也不代表管理功能已就绪。不要在未配置部署、安全与监听策略前把服务暴露到公网。

## 应用职责

- `apps/web`：Astro 页面、组件、CSS、浏览器语言路由逻辑和首页内容解析。公开输出路径 `/`、`/zh/`、`/en/`；首页在构建时从 `published_content`、`published_site` 和 `published_navigation` 读取已发布且封存的快照。不从浏览器请求数据库，也不依赖 API 服务来构建。
- `apps/api`：独立 Elysia + TypeScript Node.js 服务，依赖 Elysia `2.0.0-rc.1` 与 `@elysia/node` `2.0.0-beta.3`；目前仅有 `/health` 存活端点。无业务 CRUD、认证授权、数据库访问、联系表单或后台管理 UI。
- 根目录 `scripts/seed.mjs`：仅供本地示例环境使用，依次应用根目录 SQL schema，并创建中英文示例首页及站点导航。它不会覆盖已有数据库。
- 根目录 `astro_content_schema.sql`、`astro_site_schema_0002.sql`：SQLite 初始 schema 与增量迁移，路径及顺序属于现有数据契约；不是 API 数据访问层。

前后端当前通过同一仓库下的 workspaces 分开维护，部署和运行可以独立。还没有为它们设计或实现 HTTP 业务契约；不要臆测“前端已调用后端”。未来若新增 API，先定义具体端点、请求/响应结构、鉴权、数据访问及发布快照一致性，再由 `apps/web` 通过明确配置的 URL 调用。

## 内容与上线约定

- 英文和中文使用独立路径。仅对真实存在的译文互相提供语言链接。
- `apps/web/src/data/demo.mjs` 中的内容只是本地预览数据，明确标为示例或概念项目。站名、鹅图、个人介绍、作品和联系方式均待维护者补充。
- 当前联系区只展示未开放提示，不收集或发送个人信息。
- 未设置 `SITE_URL` 时页面输出 `noindex, follow`，省略绝对 canonical/hreflang。部署索引前必须配置真实域名。
- 本仓库仅包含静态 Astro 站和 API 开发骨架，没有 CI/CD、线上数据库、生产密钥、部署脚本或后台管理界面。根目录 [`设计.md`](设计.md) 与 [`架构.md`](架构.md) 说明设计方向及后续目标；尚未实现的规划不能当成现有能力。

## 视觉设计

首页依照 [`设计.md`](设计.md) 实现：明亮克制的青灰配色、像素鹅占位、桌面内容网格、适配手机的布局和导航。插画表达属于概念视觉，不代表真实作品。
