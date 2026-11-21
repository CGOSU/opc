-- Astro 内容站增量迁移 0002：导航、页脚、专栏、独立页面
-- 设计日期：2026-11-04
--
-- 前置：已执行上一份 astro_content_schema.sql（0001）。
-- 执行：sqlite3 -bail data/content.sqlite < astro_site_schema_0002.sql
-- 新数据库必须先执行 0001，再执行本文件。本文件仅执行一次。
-- 内容身份与已有文章实际 URL 保留；读取代码需适配 route_path/kind/template_key。
-- 本文件是数据库模型与发布契约，不包含 Astro 模板、CMS UI 或部署脚本。
--
-- 新增五表：content_revision_seals、collection_members、
-- site_revisions、site_publications、site_menu_items。
-- 页面区块使用修订内 JSON；菜单和专栏成员保留关系型外键。
-- 所有连接启用 foreign_keys；写入只通过发布服务。
-- 不要对身份表、发布表和路由表使用 INSERT OR REPLACE。
-- 下面的路由重建适用于原始 0001；若已自行增加引用它的外键/视图，先更新迁移。
--
PRAGMA foreign_keys = ON;
BEGIN;

ALTER TABLE content_items
ADD COLUMN kind TEXT NOT NULL DEFAULT 'article'
    CHECK (kind IN ('article', 'page', 'collection'));

ALTER TABLE content_revisions
ADD COLUMN template_key TEXT NOT NULL DEFAULT 'article'
    CHECK (template_key IN ('article', 'standard', 'landing', 'home', 'column', 'topic'));

ALTER TABLE content_revisions
ADD COLUMN blocks_json TEXT NOT NULL DEFAULT '[]'
    CHECK (
        CASE WHEN json_valid(blocks_json)
        THEN json_type(blocks_json) = 'array'
        ELSE 0 END
    );

-- kind 表示稳定的业务身份；template_key 是某次修订的展示方式。
CREATE TRIGGER content_items_keep_kind
BEFORE UPDATE OF kind ON content_items
WHEN NEW.kind <> OLD.kind
BEGIN
    SELECT RAISE(ABORT, 'Content kind is stable; use an explicit conversion migration.');
END;

CREATE TRIGGER content_revisions_validate_template
BEFORE INSERT ON content_revisions
WHEN NOT EXISTS (
    SELECT 1
    FROM content_translations AS t
    JOIN content_items AS c ON c.id = t.content_id
    WHERE t.id = NEW.translation_id
      AND (
          (c.kind = 'article' AND NEW.template_key = 'article')
          OR (c.kind = 'page' AND NEW.template_key IN ('standard', 'landing', 'home'))
          OR (c.kind = 'collection' AND NEW.template_key IN ('column', 'topic'))
      )
)
BEGIN
    SELECT RAISE(ABORT, 'Template does not match content kind.');
END;

-- 根修订早已不可变；此表封存修订的子项集合，使回滚时目录仍然可靠。
-- 新修订的完整保存事务：插入父修订 -> 插入成员 -> 插入 seal -> COMMIT。
-- “已封存”不等于“已发布”：发布仍由 content_publications 指针决定。
CREATE TABLE content_revision_seals (
    revision_id TEXT PRIMARY KEY NOT NULL,
    sealed_at_ms INTEGER NOT NULL CHECK (sealed_at_ms >= 0),
    FOREIGN KEY (revision_id) REFERENCES content_revisions (id)
) STRICT;

-- 0001 的已有修订没有子项，可以直接封存。
INSERT INTO content_revision_seals (revision_id, sealed_at_ms)
SELECT id, created_at_ms FROM content_revisions;

-- 一个专栏/专题对应一个 collection 内容实体。
-- 中文和英文目录分别属于各自的父修订，因此允许顺序、成员和进度不同。
-- 成员引用稳定 content_id；展示该语言当前公开版本，不复制正文。
CREATE TABLE collection_members (
    collection_revision_id TEXT NOT NULL,
    member_content_id TEXT NOT NULL,
    position INTEGER NOT NULL CHECK (position >= 0),
    is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
    require_published INTEGER NOT NULL DEFAULT 0 CHECK (require_published IN (0, 1)),

    PRIMARY KEY (collection_revision_id, member_content_id),
    UNIQUE (collection_revision_id, position),

    FOREIGN KEY (collection_revision_id) REFERENCES content_revisions (id),
    FOREIGN KEY (member_content_id) REFERENCES content_items (id)
) STRICT;

CREATE INDEX idx_collection_member_content
ON collection_members (member_content_id);

-- 迁移统一路由。所有数据库页面及系统页面共用语言内 URL 命名空间。
DROP VIEW publication_validation_errors;
DROP VIEW published_content;

CREATE TABLE content_routes_v2 (
    locale TEXT NOT NULL,
    route_path TEXT NOT NULL,
    translation_id TEXT,
    system_key TEXT,
    is_canonical INTEGER NOT NULL CHECK (is_canonical IN (0, 1)),
    created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0),

    PRIMARY KEY (locale, route_path),

    CHECK (
        (translation_id IS NOT NULL AND system_key IS NULL)
        OR (translation_id IS NULL AND system_key IS NOT NULL)
    ),
    CHECK (
        system_key IS NULL
        OR system_key IN ('home', 'articles', 'collections', 'search', 'rss')
    ),
    CHECK (
        substr(route_path, 1, 1) = '/'
        AND route_path NOT GLOB '*[^a-z0-9/._-]*'
        AND instr(route_path, '//') = 0
        AND instr(route_path, '..') = 0
        AND instr(route_path, '/./') = 0
        AND (substr(route_path, -1, 1) = '/' OR route_path = '/rss.xml')
    ),

    FOREIGN KEY (locale) REFERENCES site_locales (code),
    FOREIGN KEY (translation_id, locale)
        REFERENCES content_translations (id, locale)
) STRICT;

INSERT INTO content_routes_v2 (
    locale, route_path, translation_id, system_key, is_canonical, created_at_ms
)
SELECT
    locale, '/articles/' || slug || '/', translation_id, NULL,
    is_canonical, created_at_ms
FROM content_routes;

DROP TABLE content_routes;
ALTER TABLE content_routes_v2 RENAME TO content_routes;

CREATE UNIQUE INDEX idx_routes_one_canonical
ON content_routes (translation_id)
WHERE is_canonical = 1 AND translation_id IS NOT NULL;

CREATE UNIQUE INDEX idx_routes_one_system_canonical
ON content_routes (locale, system_key)
WHERE is_canonical = 1 AND system_key IS NOT NULL;

CREATE INDEX idx_routes_translation
ON content_routes (translation_id, locale);

-- 系统路由登记与占位。Astro 需要实现对应输出；登记本身不会生成页面。
INSERT INTO content_routes (
    locale, route_path, translation_id, system_key, is_canonical, created_at_ms
)
SELECT l.code, r.path, NULL, r.key, 1,
       CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM site_locales AS l
CROSS JOIN (
    SELECT 'home' AS key, '/' AS path
    UNION ALL SELECT 'articles', '/articles/'
    UNION ALL SELECT 'collections', '/columns/'
    UNION ALL SELECT 'search', '/search/'
    UNION ALL SELECT 'rss', '/rss.xml'
) AS r;

-- 公共区域按语言组成一个完整快照。
-- 可编辑内容包括品牌文字、logo、页脚说明、标题后缀与默认分享图。
-- SITE_URL、数据库连接、密钥、邮件服务凭证仍在环境配置，不放这些表。
CREATE TABLE site_revisions (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
    locale TEXT NOT NULL,
    revision_no INTEGER NOT NULL CHECK (revision_no > 0),
    site_name TEXT NOT NULL CHECK (length(trim(site_name)) > 0),
    tagline TEXT NOT NULL DEFAULT '',
    logo_key TEXT,
    logo_alt TEXT,
    title_suffix TEXT NOT NULL DEFAULT '',
    default_description TEXT NOT NULL DEFAULT '',
    default_og_image_key TEXT,
    footer_markdown TEXT NOT NULL DEFAULT '',
    copyright_owner TEXT NOT NULL DEFAULT '',
    copyright_start_year INTEGER CHECK (
        copyright_start_year IS NULL OR copyright_start_year >= 1900
    ),
    contact_email TEXT,
    created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0),
    sealed_at_ms INTEGER CHECK (
        sealed_at_ms IS NULL OR sealed_at_ms >= created_at_ms
    ),

    UNIQUE (locale, revision_no),
    UNIQUE (locale, id),

    CHECK (logo_key IS NOT NULL OR logo_alt IS NULL),
    FOREIGN KEY (locale) REFERENCES site_locales (code)
) STRICT;

CREATE TABLE site_publications (
    locale TEXT PRIMARY KEY NOT NULL,
    revision_id TEXT NOT NULL,
    modified_at_ms INTEGER NOT NULL CHECK (modified_at_ms >= 0),

    FOREIGN KEY (locale, revision_id) REFERENCES site_revisions (locale, id)
) STRICT;

-- 导航、页脚列、底部条款链接、社交链接共用此表。
-- 语言由 site_revision_id 决定，label/顺序/入口是否存在均可按语言独立配置。
-- 最多两级：顶层可为链接或 group；group 的子项为链接。父组须先插入。
CREATE TABLE site_menu_items (
    site_revision_id TEXT NOT NULL,
    slot TEXT NOT NULL CHECK (
        slot IN ('header_primary', 'footer_main', 'footer_legal', 'social')
    ),
    item_key TEXT NOT NULL CHECK (length(item_key) > 0),
    parent_item_key TEXT,
    label TEXT NOT NULL CHECK (length(trim(label)) > 0),
    position INTEGER NOT NULL CHECK (position >= 0),
    target_kind TEXT NOT NULL CHECK (
        target_kind IN ('internal', 'system', 'external', 'group')
    ),
    target_content_id TEXT,
    system_key TEXT CHECK (
        system_key IS NULL
        OR system_key IN ('home', 'articles', 'collections', 'search', 'rss')
    ),
    external_url TEXT,
    fragment TEXT,
    icon_key TEXT,
    open_in_new_tab INTEGER NOT NULL DEFAULT 0 CHECK (open_in_new_tab IN (0, 1)),
    rel_nofollow INTEGER NOT NULL DEFAULT 0 CHECK (rel_nofollow IN (0, 1)),
    missing_target_policy TEXT NOT NULL DEFAULT 'error'
        CHECK (missing_target_policy IN ('hide', 'error')),

    PRIMARY KEY (site_revision_id, slot, item_key),

    CHECK (
        (target_kind = 'internal' AND target_content_id IS NOT NULL
            AND system_key IS NULL AND external_url IS NULL)
        OR (target_kind = 'system' AND target_content_id IS NULL
            AND system_key IS NOT NULL AND external_url IS NULL)
        OR (target_kind = 'external' AND target_content_id IS NULL
            AND system_key IS NULL AND external_url IS NOT NULL)
        OR (target_kind = 'group' AND target_content_id IS NULL
            AND system_key IS NULL AND external_url IS NULL)
    ),
    CHECK (
        external_url IS NULL
        OR lower(external_url) LIKE 'https://%'
        OR lower(external_url) LIKE 'http://%'
        OR lower(external_url) LIKE 'mailto:%'
    ),
    CHECK (
        fragment IS NULL
        OR (target_kind IN ('internal', 'system') AND length(fragment) > 0)
    ),
    CHECK (target_kind <> 'group' OR parent_item_key IS NULL),
    CHECK (parent_item_key IS NULL OR parent_item_key <> item_key),

    FOREIGN KEY (site_revision_id) REFERENCES site_revisions (id),
    FOREIGN KEY (target_content_id) REFERENCES content_items (id),
    FOREIGN KEY (site_revision_id, slot, parent_item_key)
        REFERENCES site_menu_items (site_revision_id, slot, item_key)
) STRICT;

CREATE UNIQUE INDEX idx_site_menu_sibling_position
ON site_menu_items (
    site_revision_id, slot, COALESCE(parent_item_key, ''), position
);

CREATE INDEX idx_site_menu_target
ON site_menu_items (target_content_id);

-- 显式拒绝菜单 REPLACE，避免隐式删除绕过父组检查。
CREATE TRIGGER site_menu_no_replace
BEFORE INSERT ON site_menu_items
WHEN EXISTS (
    SELECT 1 FROM site_menu_items AS previous
    WHERE previous.site_revision_id = NEW.site_revision_id
      AND previous.slot = NEW.slot
      AND (
          previous.item_key = NEW.item_key
          OR (
              previous.position = NEW.position
              AND COALESCE(previous.parent_item_key, '')
                  = COALESCE(NEW.parent_item_key, '')
          )
      )
)
BEGIN
    SELECT RAISE(ABORT, 'Menu items cannot be replaced; update an unsealed draft explicitly.');
END;

CREATE TRIGGER site_revisions_no_replace
BEFORE INSERT ON site_revisions
WHEN EXISTS (
    SELECT 1 FROM site_revisions
    WHERE id = NEW.id
       OR (locale = NEW.locale AND revision_no = NEW.revision_no)
)
BEGIN
    SELECT RAISE(ABORT, 'Site snapshots cannot be replaced.');
END;

CREATE TRIGGER site_revisions_guard_update
BEFORE UPDATE ON site_revisions
WHEN OLD.sealed_at_ms IS NOT NULL
  OR NEW.id <> OLD.id
  OR NEW.locale <> OLD.locale
  OR NEW.revision_no <> OLD.revision_no
BEGIN
    SELECT RAISE(ABORT, 'Sealed site snapshots and snapshot identities are immutable.');
END;

CREATE TRIGGER site_revisions_no_delete
BEFORE DELETE ON site_revisions
BEGIN
    SELECT RAISE(ABORT, 'Site snapshot deletion requires a maintenance workflow.');
END;

CREATE TRIGGER site_menu_keep_parent_group
BEFORE UPDATE OF target_kind ON site_menu_items
WHEN OLD.target_kind = 'group' AND NEW.target_kind <> 'group'
 AND EXISTS (
    SELECT 1 FROM site_menu_items AS child
    WHERE child.site_revision_id = OLD.site_revision_id
      AND child.slot = OLD.slot AND child.parent_item_key = OLD.item_key
 )
BEGIN
    SELECT RAISE(ABORT, 'A menu parent with children must remain a group.');
END;

CREATE TRIGGER collection_members_sealed_insert
BEFORE INSERT ON collection_members
WHEN EXISTS (
    SELECT 1 FROM content_revision_seals
    WHERE revision_id IN (NEW.collection_revision_id)
)
BEGIN
    SELECT RAISE(ABORT, 'Collection members of a sealed revision are immutable.');
END;

CREATE TRIGGER site_menu_sealed_insert
BEFORE INSERT ON site_menu_items
WHEN EXISTS (
    SELECT 1 FROM site_revisions
    WHERE id IN (NEW.site_revision_id) AND sealed_at_ms IS NOT NULL
)
BEGIN
    SELECT RAISE(ABORT, 'Menu items of a sealed site snapshot are immutable.');
END;

CREATE TRIGGER collection_members_sealed_update
BEFORE UPDATE ON collection_members
WHEN EXISTS (
    SELECT 1 FROM content_revision_seals
    WHERE revision_id IN (OLD.collection_revision_id, NEW.collection_revision_id)
)
BEGIN
    SELECT RAISE(ABORT, 'Collection members of a sealed revision are immutable.');
END;

CREATE TRIGGER site_menu_sealed_update
BEFORE UPDATE ON site_menu_items
WHEN EXISTS (
    SELECT 1 FROM site_revisions
    WHERE id IN (OLD.site_revision_id, NEW.site_revision_id) AND sealed_at_ms IS NOT NULL
)
BEGIN
    SELECT RAISE(ABORT, 'Menu items of a sealed site snapshot are immutable.');
END;

CREATE TRIGGER collection_members_sealed_delete
BEFORE DELETE ON collection_members
WHEN EXISTS (
    SELECT 1 FROM content_revision_seals
    WHERE revision_id IN (OLD.collection_revision_id)
)
BEGIN
    SELECT RAISE(ABORT, 'Collection members of a sealed revision are immutable.');
END;

CREATE TRIGGER site_menu_sealed_delete
BEFORE DELETE ON site_menu_items
WHEN EXISTS (
    SELECT 1 FROM site_revisions
    WHERE id IN (OLD.site_revision_id) AND sealed_at_ms IS NOT NULL
)
BEGIN
    SELECT RAISE(ABORT, 'Menu items of a sealed site snapshot are immutable.');
END;

CREATE TRIGGER collection_members_validate_insert
BEFORE INSERT ON collection_members
WHEN NOT EXISTS (
    SELECT 1
    FROM content_revisions AS r
    JOIN content_translations AS t ON t.id = r.translation_id
    JOIN content_items AS c ON c.id = t.content_id
    WHERE r.id = NEW.collection_revision_id AND c.kind = 'collection'
)
OR NOT EXISTS (
    SELECT 1 FROM content_items
    WHERE id = NEW.member_content_id AND kind = 'article'
)
BEGIN
    SELECT RAISE(ABORT, 'A collection revision can contain only article identities.');
END;

CREATE TRIGGER site_menu_validate_parent_insert
BEFORE INSERT ON site_menu_items
WHEN NEW.parent_item_key IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM site_menu_items AS parent
    WHERE parent.site_revision_id = NEW.site_revision_id
      AND parent.slot = NEW.slot
      AND parent.item_key = NEW.parent_item_key
      AND parent.target_kind = 'group'
      AND parent.parent_item_key IS NULL
)
BEGIN
    SELECT RAISE(ABORT, 'Menu parent must be a root group in the same snapshot and slot.');
END;

CREATE TRIGGER content_publications_require_seal_insert
BEFORE INSERT ON content_publications
WHEN NOT EXISTS (
    SELECT 1 FROM content_revision_seals WHERE revision_id = NEW.revision_id
)
BEGIN
    SELECT RAISE(ABORT, 'Publish only complete, sealed content revisions.');
END;

CREATE TRIGGER site_publications_require_seal_insert
BEFORE INSERT ON site_publications
WHEN NOT EXISTS (
    SELECT 1 FROM site_revisions
    WHERE id = NEW.revision_id AND locale = NEW.locale
      AND sealed_at_ms IS NOT NULL
)
BEGIN
    SELECT RAISE(ABORT, 'Publish only a sealed site snapshot in the same locale.');
END;

CREATE TRIGGER collection_members_validate_update
BEFORE UPDATE ON collection_members
WHEN NOT EXISTS (
    SELECT 1
    FROM content_revisions AS r
    JOIN content_translations AS t ON t.id = r.translation_id
    JOIN content_items AS c ON c.id = t.content_id
    WHERE r.id = NEW.collection_revision_id AND c.kind = 'collection'
)
OR NOT EXISTS (
    SELECT 1 FROM content_items
    WHERE id = NEW.member_content_id AND kind = 'article'
)
BEGIN
    SELECT RAISE(ABORT, 'A collection revision can contain only article identities.');
END;

CREATE TRIGGER site_menu_validate_parent_update
BEFORE UPDATE ON site_menu_items
WHEN NEW.parent_item_key IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM site_menu_items AS parent
    WHERE parent.site_revision_id = NEW.site_revision_id
      AND parent.slot = NEW.slot
      AND parent.item_key = NEW.parent_item_key
      AND parent.target_kind = 'group'
      AND parent.parent_item_key IS NULL
)
BEGIN
    SELECT RAISE(ABORT, 'Menu parent must be a root group in the same snapshot and slot.');
END;

CREATE TRIGGER content_publications_require_seal_update
BEFORE UPDATE ON content_publications
WHEN NOT EXISTS (
    SELECT 1 FROM content_revision_seals WHERE revision_id = NEW.revision_id
)
BEGIN
    SELECT RAISE(ABORT, 'Publish only complete, sealed content revisions.');
END;

CREATE TRIGGER site_publications_require_seal_update
BEFORE UPDATE ON site_publications
WHEN NOT EXISTS (
    SELECT 1 FROM site_revisions
    WHERE id = NEW.revision_id AND locale = NEW.locale
      AND sealed_at_ms IS NOT NULL
)
BEGIN
    SELECT RAISE(ABORT, 'Publish only a sealed site snapshot in the same locale.');
END;

CREATE TRIGGER content_revision_seals_no_update
BEFORE UPDATE ON content_revision_seals
BEGIN
    SELECT RAISE(ABORT, 'Content revision seals are immutable.');
END;

CREATE TRIGGER content_revision_seals_no_delete
BEFORE DELETE ON content_revision_seals
BEGIN
    SELECT RAISE(ABORT, 'Content revision seals are immutable.');
END;

CREATE TRIGGER content_revision_seals_no_replace
BEFORE INSERT ON content_revision_seals
WHEN EXISTS (
    SELECT 1 FROM content_revision_seals WHERE revision_id = NEW.revision_id
)
BEGIN
    SELECT RAISE(ABORT, 'Content revision seals cannot be replaced.');
END;

-- 通用公开视图：kind 是必要字段；文章列表和 RSS 改用 published_articles。
CREATE VIEW published_content AS
SELECT
    t.content_id,
    c.kind,
    t.id AS translation_id,
    t.locale,
    l.lang_tag,
    route.route_path,
    '/' || t.locale || route.route_path AS path,
    r.id AS revision_id,
    r.revision_no,
    r.template_key,
    r.blocks_json,
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
JOIN content_items AS c ON c.id = t.content_id
JOIN site_locales AS l ON l.code = t.locale
JOIN content_revisions AS r
    ON r.translation_id = p.translation_id AND r.id = p.revision_id
JOIN content_revision_seals AS seal ON seal.revision_id = r.id
JOIN content_routes AS route
    ON route.translation_id = t.id AND route.locale = t.locale
    AND route.is_canonical = 1
WHERE p.is_live = 1;

CREATE VIEW published_articles AS
SELECT * FROM published_content WHERE kind = 'article';

CREATE VIEW published_site AS
SELECT s.*, p.modified_at_ms
FROM site_publications AS p
JOIN site_revisions AS s ON s.id = p.revision_id AND s.locale = p.locale
WHERE s.sealed_at_ms IS NOT NULL;

-- fragment 在服务层按 URL fragment 规范校验/编码。
CREATE VIEW published_navigation AS
SELECT
    site.locale,
    menu.*,
    CASE menu.target_kind
        WHEN 'internal' THEN target.path
        WHEN 'system' THEN '/' || site.locale || system.route_path
        WHEN 'external' THEN menu.external_url
        ELSE NULL
    END AS base_href
FROM published_site AS site
JOIN site_menu_items AS menu ON menu.site_revision_id = site.id
LEFT JOIN published_content AS target
    ON target.content_id = menu.target_content_id AND target.locale = site.locale
LEFT JOIN content_routes AS system
    ON system.locale = site.locale AND system.system_key = menu.system_key
    AND system.is_canonical = 1
WHERE menu.target_kind IN ('external', 'group')
   OR (menu.target_kind = 'internal' AND target.path IS NOT NULL)
   OR (menu.target_kind = 'system' AND system.route_path IS NOT NULL);

CREATE VIEW published_collection_members AS
SELECT
    parent.content_id AS collection_content_id,
    parent.revision_id AS collection_revision_id,
    parent.locale,
    m.position,
    m.is_featured,
    article.content_id AS member_content_id,
    article.translation_id AS member_translation_id,
    article.revision_id AS member_revision_id,
    article.title AS member_title,
    article.path AS member_path,
    article.summary AS member_summary
FROM published_content AS parent
JOIN collection_members AS m ON m.collection_revision_id = parent.revision_id
JOIN published_articles AS article
    ON article.content_id = m.member_content_id AND article.locale = parent.locale
WHERE parent.kind = 'collection';

CREATE VIEW publication_validation_errors AS
SELECT
    p.translation_id AS entity_id,
    'missing_canonical_route' AS error_code
FROM content_publications AS p
WHERE p.is_live = 1 AND NOT EXISTS (
    SELECT 1 FROM content_routes AS route
    WHERE route.translation_id = p.translation_id AND route.is_canonical = 1
)
UNION ALL
SELECT p.translation_id, 'unsealed_content_revision'
FROM content_publications AS p
WHERE p.is_live = 1 AND NOT EXISTS (
    SELECT 1 FROM content_revision_seals WHERE revision_id = p.revision_id
);

-- required 菜单缺少同语言公开目标时必须让构建失败。
-- hide 菜单则已由 published_navigation 隐藏；渲染器还应移除空 group。
CREATE VIEW navigation_validation_errors AS
SELECT site.id AS entity_id, menu.slot, menu.item_key,
       'missing_menu_target' AS error_code
FROM published_site AS site
JOIN site_menu_items AS menu ON menu.site_revision_id = site.id
LEFT JOIN published_content AS target
    ON target.content_id = menu.target_content_id AND target.locale = site.locale
LEFT JOIN content_routes AS system
    ON system.locale = site.locale AND system.system_key = menu.system_key
    AND system.is_canonical = 1
WHERE menu.missing_target_policy = 'error' AND (
    (menu.target_kind = 'internal' AND target.path IS NULL)
    OR (menu.target_kind = 'system' AND system.route_path IS NULL)
);

CREATE VIEW collection_validation_errors AS
SELECT parent.translation_id AS entity_id, m.member_content_id,
       'required_member_not_published_in_locale' AS error_code
FROM published_content AS parent
JOIN collection_members AS m ON m.collection_revision_id = parent.revision_id
LEFT JOIN published_articles AS article
    ON article.content_id = m.member_content_id AND article.locale = parent.locale
WHERE parent.kind = 'collection' AND m.require_published = 1
  AND article.content_id IS NULL;

PRAGMA foreign_key_check;
COMMIT;

-- ======================== 发布与读取契约 ========================
--
-- 页面类型：
-- article + article     ：常规文章
-- page + standard       ：关于、联系、说明等 Markdown 页面
-- page + landing / home ：带结构化区块的落地页或首页
-- collection + column   ：有固定顺序的专栏/系列
-- collection + topic    ：人工策划专题
--
-- 专栏目录保存：
-- 1. BEGIN IMMEDIATE；插入一个新的 content_revisions。
-- 2. 为新修订插入完整 collection_members（从旧版复制后调整也可以）。
-- 3. INSERT INTO content_revision_seals VALUES (:revision_id, :now_ms)。
-- 4. COMMIT。这样只生成草稿快照，不切换线上 publication。
-- 5. 发布时更新 content_publications，验证所有门禁，再 build/deploy。
-- 普通文章和 page 也要在保存事务中增加 seal 行，即使没有 collection_members。
--
-- 公共区域保存：
-- 1. BEGIN IMMEDIATE；复制 site_revisions 和全部 site_menu_items 到新修订。
-- 2. 修改新修订的公共文字和菜单。
-- 3. UPDATE site_revisions SET sealed_at_ms=:now WHERE id=:new_id。
-- 4. COMMIT。发布时将该 locale 的 site_publications 指向新修订。
-- 封存后禁止父快照及菜单的新增/修改/删除；旧快照也不解冻。
-- site_publications 的主键是 locale，中英文可以分别发布。
--
-- 导航读取：
-- SELECT * FROM published_navigation
-- WHERE locale=:locale AND slot=:slot
-- ORDER BY parent_item_key, position, item_key;
-- 按 parent_item_key 组装两级树；输出普通 HTML a[href]。
-- internal 根据内容身份解析同语言当前 URL，不在菜单存 /zh/... 这样的硬编码路径。
-- external URL 必须在服务层用 URL parser 再校验；CHECK 只做基础协议限制。
-- system_key 由代码白名单解释，禁止把任意路由名当作代码执行。
--
-- 专栏读取：
-- SELECT * FROM published_collection_members
-- WHERE collection_content_id=:content_id AND locale=:locale
-- ORDER BY position;
-- 目录引用的是成员的内容身份，展示成员当前公开修订。
-- 若要复现整套课程历史，需另加成员 revision_id 固定机制，此版不实现。
--
-- 区块数据示例（存入 blocks_json；仅表示展示结构，不能存 SQL/JS）：
-- [
--   {"key":"intro","type":"hero","version":1,
--    "data":{"heading":"Agent 开发专栏","description":"从原理到工程实践"}},
--   {"key":"benefits","type":"feature_list","version":1,
--    "data":{"items":[{"title":"运行时","text":"理解任务调度与生命周期"}]}}
-- ]
-- 每个 type 都由代码中已注册的 Astro 组件渲染，并用独立 schema 校验 data。
-- SQL 只保证有效 JSON 数组；未知 type、字段、ID 引用、层数和数量由发布校验负责。
-- article_list 等需要筛选的区块只能配置白名单参数，不能存任意 SQL。
-- 页面区块若以后需要独立搜索/协作/复用，再关系化；第一版无需 page_blocks 表。
--
-- 路由：
-- route_path 是语言内路径；最终 URL = SITE_URL + '/' + locale + route_path。
-- 菜单、专栏和区块的站内引用统一用内容身份解析，不能各自拼 slug。
-- 根 /zh/ 默认由 system_key=home 占用；如果首页改成可编辑 page，
-- 在同一事务内把该路由的目标切为首页 translation，并把首页菜单改为 internal。
-- 不能让系统首页和可编辑首页同时拥有 /zh/。
-- 新增语言时，要同时登记该语言的系统路由和公共区域快照。
-- 系统路由登记不意味着它已经可访问；构建门禁还需检查实际输出是否存在。
--
-- 迁移后的代码调整：
-- * getStaticPaths 用 route_path 生成路径，不能再固定拼 /articles/{slug}/。
-- * 文章列表/RSS 使用 published_articles；所有独立页面用 published_content。
-- * sitemap 包括可索引的文章、专栏、页面及实际存在的系统列表页。
-- * 页脚/导航、专栏目录、文章、sitemap、重定向表使用同一次构建快照。
-- * 页面类型使用正确语义；专栏聚合页不要自动标成 Article。
-- * 面包屑依据页面与内容关系生成，不由当前菜单树推导。
--
-- 必要发布校验：
-- PRAGMA foreign_key_check；
-- publication_validation_errors；
-- navigation_validation_errors；
-- collection_validation_errors；
-- 每个启用语言已配置 site_publications；
-- blocks_json 的应用 schema、资源存在性、系统路由实现、所有链接目标。
-- required 目标错误必须中止发布/构建；普通未翻译的专栏成员可隐藏。
-- noindex 是索引策略，不是访问权限；它不影响导航或专栏的正常内部访问。
--
-- 仍由应用保证：发布首次时间、旧路由不删除/不转让、页面发布权限、
-- 同一时刻的内容快照、构建与线上部署的一致性。这里没有实现完整 CMS。
--
-- 参考（官方）：
-- https://www.sqlite.org/lang_altertable.html
-- https://www.sqlite.org/foreignkeys.html
-- https://www.sqlite.org/lang_createtrigger.html
-- https://www.sqlite.org/json1.html
-- https://developers.google.com/search/docs/crawling-indexing/links-crawlable
-- https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
