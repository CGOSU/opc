-- Astro 中英文内容站：SQLite 初始迁移（v1）
-- 设计日期：2026-11-04
--
-- 运行：mkdir -p data
--       sqlite3 -bail data/content.sqlite < astro_content_schema.sql
-- 这是一次性初始迁移；后续结构变更另写迁移，不重复执行本文件。
-- 需要 SQLite >= 3.37（STRICT 支持）；生产环境使用维护中的修复版本。
--
-- 约定：
-- 1. ID 由应用生成 UUID 文本；所有 *_at_ms 都是 UTC Unix 毫秒。
-- 2. locale 是 URL 段（zh/en）；lang_tag 是 HTML/hreflang 标签。
-- 3. 内容身份、语言身份、修订、发布指针、URL 分开管理。
-- 4. 修订只追加；公开读取始终通过 published_content，不能读取“最新修订”。
-- 5. 本版文章路径固定为 /{locale}/articles/{slug}/。
--    slug 使用小写 ASCII 字母、数字及单个连字符；这是本方案的运维选择，
--    不是搜索引擎的限制。若改用 Unicode slug，另写规范化规则及迁移。
-- 6. 改 URL 是显式发布操作，不能在“保存草稿”时修改 content_routes。
-- 7. 没有 publication 行表示从未发布；is_live=0 表示下线并保留发布历史。
-- 8. 没有定时发布器、CMS 登录、构建脚本或 HTTP 重定向执行器；这些由应用实现。
--
-- 每一个数据库连接都必须在事务外执行 foreign_keys=ON。
-- 可为读写连接设置 busy_timeout=5000；WAL 在数据库初始化阶段启用。
-- 数据库及 WAL/SHM 文件不能放进 public/ 或公开部署产物。

PRAGMA foreign_keys = ON;

BEGIN;

CREATE TABLE site_locales (
    code TEXT PRIMARY KEY NOT NULL,
    lang_tag TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    CHECK (length(code) > 0),
    CHECK (code NOT GLOB '*[^a-z0-9-]*')
) STRICT;

INSERT INTO site_locales (code, lang_tag, display_name)
VALUES
    ('zh', 'zh-Hans', '简体中文'),
    ('en', 'en', 'English');

-- 跨语言的稳定内容身份。不能把 slug、标题或语言当作内容 ID。
CREATE TABLE content_items (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
    created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0)
) STRICT;

-- 一篇内容的一个语言版本；一个 content_id 每种语言最多有一个版本。
CREATE TABLE content_translations (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
    content_id TEXT NOT NULL,
    locale TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0),

    UNIQUE (content_id, locale),
    UNIQUE (id, locale),

    FOREIGN KEY (content_id) REFERENCES content_items (id),
    FOREIGN KEY (locale) REFERENCES site_locales (code)
) STRICT;

CREATE INDEX idx_translations_locale
    ON content_translations (locale, id);

-- 一次完整的内容快照，包括会影响公开页面的 SEO、封面和来源元数据。
-- 默认单个来源；若以后支持多个来源，新增与 revision_id 关联的快照子表，
-- 不要把可变来源行直接关联 content_id 后声称所有草稿均已隔离。
-- Markdown 为正文原始数据；HTML、目录、阅读时间和搜索索引在构建时派生。
CREATE TABLE content_revisions (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
    translation_id TEXT NOT NULL,
    revision_no INTEGER NOT NULL CHECK (revision_no > 0),

    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    summary TEXT NOT NULL DEFAULT '',
    body_markdown TEXT NOT NULL,

    seo_title TEXT,
    seo_description TEXT,
    noindex INTEGER NOT NULL DEFAULT 0 CHECK (noindex IN (0, 1)),

    cover_key TEXT,
    cover_alt TEXT,

    source_url TEXT,
    source_title TEXT,
    source_author TEXT,
    source_published_at_ms INTEGER,

    created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0),

    UNIQUE (translation_id, revision_no),
    UNIQUE (translation_id, id),

    CHECK (source_published_at_ms IS NULL OR source_published_at_ms >= 0),
    CHECK (cover_key IS NOT NULL OR cover_alt IS NULL),

    FOREIGN KEY (translation_id) REFERENCES content_translations (id)
) STRICT;

-- 通过追加新快照纠错；回滚发布只需把 publication 指回旧修订。
-- 本版不提供内容硬删除。需要维护清理时另做受控清理迁移。
-- INSERT OR REPLACE 可能通过隐式删除绕开普通 UPDATE/DELETE 触发器，
-- 因此在 INSERT 前也拦截已有 ID 或已有修订序号；修订写入只用 INSERT。
CREATE TRIGGER content_revisions_no_replace
BEFORE INSERT ON content_revisions
WHEN EXISTS (
    SELECT 1 FROM content_revisions AS previous
    WHERE previous.id = NEW.id
       OR (
           previous.translation_id = NEW.translation_id
           AND previous.revision_no = NEW.revision_no
       )
)
BEGIN
    SELECT RAISE(ABORT, 'Content revisions cannot be replaced; append a new revision.');
END;

CREATE TRIGGER content_revisions_no_update
BEFORE UPDATE ON content_revisions
BEGIN
    SELECT RAISE(ABORT, 'Content revisions are immutable; append a new revision.');
END;

CREATE TRIGGER content_revisions_no_delete
BEFORE DELETE ON content_revisions
BEGIN
    SELECT RAISE(ABORT, 'Content revision deletion requires an explicit maintenance workflow.');
END;

-- 每种语言独立发布。复合外键阻止把中文 publication 指向英文修订。
-- first_published_at_ms：该语言版本首次发布时刻，重新发布时保持不变。
-- modified_at_ms：最近一次有意义的公开内容变更时刻；不能每次 build 都刷新。
CREATE TABLE content_publications (
    translation_id TEXT PRIMARY KEY NOT NULL,
    revision_id TEXT NOT NULL,
    is_live INTEGER NOT NULL DEFAULT 1 CHECK (is_live IN (0, 1)),
    first_published_at_ms INTEGER NOT NULL CHECK (first_published_at_ms >= 0),
    modified_at_ms INTEGER NOT NULL,

    CHECK (modified_at_ms >= first_published_at_ms),

    FOREIGN KEY (translation_id, revision_id)
        REFERENCES content_revisions (translation_id, id)
) STRICT;

CREATE INDEX idx_publications_feed
    ON content_publications (first_published_at_ms DESC, translation_id)
    WHERE is_live = 1;

-- 同一个命名空间中统一保留新旧 slug，防止旧 URL 被其他文章抢占。
-- is_canonical=0 的旧地址指向语言版本身份，再解析其当前地址，避免跳转链。
-- 此表只覆盖 /{locale}/articles/{slug}/，分类等未来使用独立路径前缀。
CREATE TABLE content_routes (
    locale TEXT NOT NULL,
    slug TEXT NOT NULL,
    translation_id TEXT NOT NULL,
    is_canonical INTEGER NOT NULL CHECK (is_canonical IN (0, 1)),
    created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0),

    PRIMARY KEY (locale, slug),

    CHECK (
        length(slug) > 0
        AND slug NOT GLOB '*[^a-z0-9-]*'
        AND substr(slug, 1, 1) <> '-'
        AND substr(slug, -1, 1) <> '-'
        AND instr(slug, '--') = 0
    ),

    FOREIGN KEY (translation_id, locale)
        REFERENCES content_translations (id, locale)
) STRICT;

-- 数据库保证“至多一个当前地址”；发布/构建校验保证“至少一个”。
CREATE UNIQUE INDEX idx_routes_one_canonical
    ON content_routes (translation_id)
    WHERE is_canonical = 1;

CREATE INDEX idx_routes_translation
    ON content_routes (translation_id, locale);

-- 所有公开 HTML、列表、RSS 和公开内容 API 的统一读取入口。
-- noindex 内容可以供用户访问，但应从 sitemap 和 hreflang 集合中排除。
-- 在构建阶段，应对一次固定数据库快照查询这个视图。
CREATE VIEW published_content AS
SELECT
    t.content_id,
    t.id AS translation_id,
    t.locale,
    l.lang_tag,
    route.slug,
    '/' || t.locale || '/articles/' || route.slug || '/' AS path,
    r.id AS revision_id,
    r.revision_no,
    r.title,
    r.summary,
    r.body_markdown,
    r.seo_title,
    r.seo_description,
    r.noindex,
    r.cover_key,
    r.cover_alt,
    r.source_url,
    r.source_title,
    r.source_author,
    r.source_published_at_ms,
    p.first_published_at_ms,
    p.modified_at_ms
FROM content_publications AS p
JOIN content_translations AS t ON t.id = p.translation_id
JOIN site_locales AS l ON l.code = t.locale
JOIN content_revisions AS r
    ON r.translation_id = p.translation_id AND r.id = p.revision_id
JOIN content_routes AS route
    ON route.translation_id = t.id
    AND route.locale = t.locale
    AND route.is_canonical = 1
WHERE p.is_live = 1;

-- 发布或构建前查询本视图；存在任何行就中止发布。
-- 不能仅查询 published_content 判断合法，因为 INNER JOIN 会隐藏缺路由记录。
CREATE VIEW publication_validation_errors AS
SELECT
    p.translation_id,
    'missing_canonical_route' AS error_code
FROM content_publications AS p
WHERE p.is_live = 1
  AND NOT EXISTS (
      SELECT 1
      FROM content_routes AS route
      WHERE route.translation_id = p.translation_id
        AND route.is_canonical = 1
  );

COMMIT;

-- ======================== 应用层契约与查询示例 ========================
-- 保存草稿：
--   BEGIN IMMEDIATE;
--   取该 translation_id 的 COALESCE(MAX(revision_no), 0)+1，插入新修订；
--   COMMIT;
--   不修改 content_publications 或 content_routes。
--   多编辑者场景还应提交 base_revision_id，发现版本过期就提示冲突。
--
-- 发布：在一个事务里校验修订、更新当前 URL 与 publication，检查
-- publication_validation_errors 为空，然后提交。
-- 首次发布插入 publication，之后更新 revision_id/is_live/modified_at_ms；
-- first_published_at_ms 保持不变。下线只把 is_live 改为 0。
--
-- 改 slug：
--   BEGIN IMMEDIATE;
--   确认目标 slug 未被其他语言版本占用；
--   将当前 route 的 is_canonical 改成 0；
--   为同一 translation_id 插入新 route，或把它已有的旧 route 激活为 1；
--   检查 publication_validation_errors 为空；
--   COMMIT;
-- 不删除旧 route；线上 HTTP 301 规则由部署器/服务器从旧新映射生成。
-- 下线内容的旧路由不可重定向到不存在的页面；根据策略返回 404/410。
--
-- 当前语言的公开列表（绑定参数；禁止拼接用户输入）：
-- SELECT * FROM published_content
-- WHERE locale = :locale
-- ORDER BY first_published_at_ms DESC, translation_id
-- LIMIT :limit OFFSET :offset;
--
-- 同篇内容的已发布且可索引语言版本（生成 hreflang）：
-- SELECT locale, lang_tag, path FROM published_content
-- WHERE content_id = :content_id AND noindex = 0;
--
-- 公开旧 URL 跳转映射（不会产生多级跳转）：
-- SELECT
--   '/' || old.locale || '/articles/' || old.slug || '/' AS from_path,
--   current.path AS to_path
-- FROM content_routes AS old
-- JOIN published_content AS current ON current.translation_id = old.translation_id
-- WHERE old.is_canonical = 0;
--
-- 发布门禁还应覆盖：PRAGMA foreign_key_check；正文/图片/链接校验；
-- lang_tag 合法性；canonical 唯一性；hreflang 双向对应；站点根 URL 配置。
-- 路由、HTML、sitemap、RSS、重定向表和搜索索引使用同一份发布快照。
--
-- 一致性：authoring DB 的发布指针变化，不代表静态文件已经上线。
-- 若公开内容 API 必须与静态页面同版本，让它读取该次部署的只读内容快照；
-- 编辑后台继续写主库。表单/投票等实时业务可使用独立运行时数据库。
--
-- 扩展：分类/标签使用 taxonomy_terms、taxonomy_translations 和关联表；
-- 标签名称/slug 可翻译，不能在 content_items 加 title_zh/title_en 等列。
-- 若标签、作者或来源也需要随草稿一起审核，应与修订绑定或在发布时快照化。
-- 封面使用对象 key 或相对路径，不能保存开发机绝对路径。
--
-- 迁服务器：使用 SQLite Online Backup API 或 VACUUM INTO 生成一致副本；
-- 不要在 WAL 活跃时仅复制 .sqlite 文件。数据库位于持久目录，和应用版本分离。
-- 上服务器之后只保留一个主写入库，避免本地和服务器各写后再覆盖整库。
--
-- 迁 PostgreSQL：模型可沿用，DDL/驱动/迁移需要改；INTEGER 毫秒字段改 BIGINT
-- 或转换为 timestamptz；0/1 改 boolean（或维持 integer CHECK）；移除 STRICT；
-- 为不可变修订重写触发器；验证排序、全文检索及参数占位符。
--
-- 参考资料（官方）：
-- https://docs.astro.build/en/guides/on-demand-rendering/
-- https://docs.astro.build/en/guides/integrations-guide/node/
-- https://docs.astro.build/en/guides/content-collections/
-- https://www.sqlite.org/foreignkeys.html
-- https://www.sqlite.org/stricttables.html
-- https://www.sqlite.org/wal.html
-- https://www.sqlite.org/backup.html
-- https://www.postgresql.org/docs/current/datatype-numeric.html
-- https://developers.google.com/search/docs/specialty/international/localized-versions
