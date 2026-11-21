-- Keep generic article identities for sealed navigation/collection references.
-- Their old revisions and publication pointers remain archival; only the new
-- tables drive current article reads and writes.
BEGIN;

CREATE TABLE posts (
    id TEXT PRIMARY KEY NOT NULL REFERENCES content_items(id),
    category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
    cover_image TEXT,
    use_shared_cover INTEGER NOT NULL DEFAULT 1 CHECK (use_shared_cover IN (0, 1)),
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
) STRICT;
CREATE INDEX posts_by_category ON posts(category_id);

CREATE TABLE post_translations (
    id TEXT PRIMARY KEY NOT NULL,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    locale TEXT NOT NULL REFERENCES site_locales(code),
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    slug TEXT,
    summary TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    seo_title TEXT,
    seo_description TEXT,
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    published_at INTEGER,
    first_published_at_ms INTEGER,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    legacy_revision_id TEXT REFERENCES content_revisions(id),
    noindex INTEGER NOT NULL DEFAULT 0 CHECK (noindex IN (0, 1)),
    blocks_json TEXT NOT NULL DEFAULT '[]',
    legacy_cover_url TEXT,
    cover_key TEXT,
    cover_alt TEXT,
    source_url TEXT,
    source_title TEXT,
    source_author TEXT,
    source_published_at_ms INTEGER,
    UNIQUE (post_id, locale),
    UNIQUE (locale, slug),
    UNIQUE (id, locale)
) STRICT;

-- First creation starts at 1. A deleted language can be recreated, but must
-- not reuse a revision that a client may still hold for the same post and locale.
CREATE TABLE post_translation_revision_floors (
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    locale TEXT NOT NULL REFERENCES site_locales(code),
    revision INTEGER NOT NULL CHECK (revision > 0),
    PRIMARY KEY (post_id, locale)
) STRICT;

CREATE TABLE post_routes (
    locale TEXT NOT NULL,
    route_path TEXT NOT NULL,
    translation_id TEXT NOT NULL,
    is_canonical INTEGER NOT NULL CHECK (is_canonical IN (0, 1)),
    created_at_ms INTEGER NOT NULL,
    PRIMARY KEY (locale, route_path),
    FOREIGN KEY (translation_id, locale) REFERENCES post_translations(id, locale) ON DELETE CASCADE
) STRICT;
CREATE INDEX post_routes_by_translation ON post_routes(translation_id);
CREATE UNIQUE INDEX post_routes_canonical ON post_routes(translation_id) WHERE is_canonical = 1;

INSERT INTO posts (id, category_id, use_shared_cover, created_at_ms, updated_at_ms)
SELECT c.id, pc.category_id, 0, c.created_at_ms, c.created_at_ms
FROM content_items c LEFT JOIN post_categories pc ON pc.post_id = c.id
WHERE c.kind = 'article' AND (
    EXISTS (SELECT 1 FROM content_translations t JOIN content_revisions r ON r.translation_id = t.id
        WHERE t.content_id = c.id)
    OR pc.post_id IS NOT NULL
    OR EXISTS (SELECT 1 FROM post_tags t WHERE t.post_id = c.id)
);

-- A live or withdrawn pointer wins over a newer, non-public snapshot. For
-- never-published languages preserve the latest actual draft, not an empty row.
INSERT INTO post_translations (
    id, post_id, locale, title, slug, summary, content, seo_title, seo_description,
    revision, published_at, first_published_at_ms, created_at_ms, updated_at_ms,
    legacy_revision_id, noindex, blocks_json, legacy_cover_url, cover_key, cover_alt,
    source_url, source_title, source_author, source_published_at_ms
)
SELECT t.id, t.content_id, t.locale, r.title,
       CASE WHEN route.route_path GLOB '/articles/*/'
         AND instr(substr(route.route_path, 11, length(route.route_path) - 11), '/') = 0
         THEN substr(route.route_path, 11, length(route.route_path) - 11) END,
       r.summary, r.body_markdown, r.seo_title, r.seo_description, r.revision_no,
       CASE WHEN pub.is_live = 1 AND seal.revision_id IS NOT NULL THEN pub.first_published_at_ms END,
       pub.first_published_at_ms, t.created_at_ms, coalesce(pub.modified_at_ms, r.created_at_ms),
       r.id, r.noindex, r.blocks_json, cover.url, r.cover_key, r.cover_alt,
       r.source_url, r.source_title, r.source_author, r.source_published_at_ms
FROM content_translations t
JOIN posts p ON p.id = t.content_id
LEFT JOIN content_publications pub ON pub.translation_id = t.id
JOIN content_revisions r ON r.translation_id = t.id AND r.id = coalesce(pub.revision_id, (
    SELECT latest.id FROM content_revisions latest WHERE latest.translation_id = t.id
    ORDER BY latest.revision_no DESC LIMIT 1
))
LEFT JOIN content_revision_seals seal ON seal.revision_id = r.id
LEFT JOIN content_routes route ON route.translation_id = t.id AND route.is_canonical = 1
LEFT JOIN article_revision_covers cover ON cover.revision_id = r.id;

UPDATE posts
SET updated_at_ms = max(created_at_ms, coalesce((
    SELECT max(t.updated_at_ms) FROM post_translations t WHERE t.post_id = posts.id
), created_at_ms));

-- Consolidate identical remote covers. Differing URLs or legacy asset keys
-- keep their original per-language rendering until a shared cover is saved.
UPDATE posts
SET cover_image = (SELECT max(t.legacy_cover_url) FROM post_translations t WHERE t.post_id = posts.id),
    use_shared_cover = 1
WHERE NOT EXISTS (SELECT 1 FROM post_translations t WHERE t.post_id = posts.id AND t.cover_key IS NOT NULL)
  AND (SELECT count(DISTINCT coalesce(t.legacy_cover_url, ''))
       FROM post_translations t WHERE t.post_id = posts.id) <= 1;

INSERT INTO post_routes
SELECT r.locale, r.route_path, r.translation_id, r.is_canonical, r.created_at_ms
FROM content_routes r JOIN post_translations t ON t.id = r.translation_id;
DELETE FROM content_routes WHERE translation_id IN (SELECT id FROM post_translations);

DROP TRIGGER article_slug_insert;
DROP TRIGGER article_translation_delete;
DROP TRIGGER topic_posts_cleanup;
DROP TRIGGER topic_post_requires_article;
DROP TABLE post_categories;

-- These associations now reference the actual post, not a generic content item.
CREATE TABLE post_tags_v2 (
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
) STRICT;
INSERT INTO post_tags_v2 SELECT post_id, tag_id FROM post_tags;
DROP TABLE post_tags;
ALTER TABLE post_tags_v2 RENAME TO post_tags;
CREATE INDEX idx_post_tags_tag ON post_tags(tag_id);

-- Replace the dependent view before rebuilding topic_posts so SQLite can
-- validate the schema during the table rename.
DROP VIEW public_topic_members;
CREATE TABLE topic_posts_v2 (
    topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    PRIMARY KEY (topic_id, post_id),
    UNIQUE (topic_id, sort_order)
) STRICT;
INSERT INTO topic_posts_v2 SELECT topic_id, post_id, sort_order FROM topic_posts;
DROP TABLE topic_posts;
ALTER TABLE topic_posts_v2 RENAME TO topic_posts;
CREATE INDEX topic_posts_by_post ON topic_posts(post_id, topic_id);

-- The two route registries share a locale/path namespace. Routes are created
-- by translation triggers, so a slug conflict rolls back the CAS itself.
CREATE TRIGGER post_route_reserve BEFORE INSERT ON post_routes
WHEN EXISTS (SELECT 1 FROM content_routes WHERE locale = NEW.locale AND route_path = NEW.route_path)
   OR EXISTS (SELECT 1 FROM topics WHERE NEW.route_path = '/topics/' || slug || '/')
BEGIN
    SELECT RAISE(ABORT, 'DUPLICATE_ARTICLE_SLUG');
END;
CREATE TRIGGER content_route_reserve_post_insert BEFORE INSERT ON content_routes
WHEN EXISTS (SELECT 1 FROM post_routes WHERE locale = NEW.locale AND route_path = NEW.route_path)
BEGIN
    SELECT RAISE(ABORT, 'DUPLICATE_ARTICLE_SLUG');
END;
CREATE TRIGGER content_route_reserve_post_update BEFORE UPDATE OF locale, route_path ON content_routes
WHEN EXISTS (SELECT 1 FROM post_routes WHERE locale = NEW.locale AND route_path = NEW.route_path)
BEGIN
    SELECT RAISE(ABORT, 'DUPLICATE_ARTICLE_SLUG');
END;
CREATE TRIGGER topic_slug_reserve_post_insert BEFORE INSERT ON topics
WHEN EXISTS (SELECT 1 FROM post_routes WHERE route_path = '/topics/' || NEW.slug || '/')
BEGIN
    SELECT RAISE(ABORT, 'DUPLICATE_TOPIC_SLUG');
END;
CREATE TRIGGER topic_slug_reserve_post_update BEFORE UPDATE OF slug ON topics
WHEN EXISTS (SELECT 1 FROM post_routes WHERE route_path = '/topics/' || NEW.slug || '/')
BEGIN
    SELECT RAISE(ABORT, 'DUPLICATE_TOPIC_SLUG');
END;

CREATE TRIGGER post_translation_route_create AFTER INSERT ON post_translations
WHEN NEW.slug IS NOT NULL
BEGIN
    INSERT INTO post_routes VALUES (NEW.locale, '/articles/' || NEW.slug || '/', NEW.id, 1, NEW.created_at_ms);
END;

CREATE TRIGGER post_translation_route_change AFTER UPDATE OF slug ON post_translations
WHEN NEW.slug IS NOT NULL AND (OLD.slug IS NOT NEW.slug OR NOT EXISTS (
    SELECT 1 FROM post_routes WHERE translation_id = NEW.id AND is_canonical = 1
))
BEGIN
    UPDATE post_routes SET is_canonical = 0 WHERE translation_id = NEW.id AND is_canonical = 1;
    INSERT INTO post_routes (locale, route_path, translation_id, is_canonical, created_at_ms)
    SELECT NEW.locale, '/articles/' || NEW.slug || '/', NEW.id, 1, NEW.updated_at_ms
    WHERE NOT EXISTS (SELECT 1 FROM post_routes WHERE translation_id = NEW.id
        AND route_path = '/articles/' || NEW.slug || '/');
    UPDATE post_routes SET is_canonical = 1 WHERE translation_id = NEW.id
        AND route_path = '/articles/' || NEW.slug || '/';
END;

CREATE VIEW current_articles AS
SELECT t.post_id AS content_id, 'article' AS kind, t.id AS translation_id, t.locale,
       l.lang_tag, route.route_path, '/' || t.locale || route.route_path AS path,
       t.legacy_revision_id AS revision_id, t.revision AS revision_no,
       'article' AS template_key, t.blocks_json, t.title, t.summary, t.content AS body_markdown,
       t.seo_title, t.seo_description, t.noindex,
       CASE WHEN p.use_shared_cover = 0 THEN t.cover_key END AS cover_key,
       CASE WHEN p.use_shared_cover = 0 THEN t.cover_alt END AS cover_alt,
       t.source_url, t.source_title, t.source_author, t.source_published_at_ms,
       t.published_at AS first_published_at_ms, t.updated_at_ms AS modified_at_ms,
       CASE WHEN p.use_shared_cover = 1 THEN p.cover_image ELSE t.legacy_cover_url END AS cover_url
FROM post_translations t
JOIN posts p ON p.id = t.post_id
JOIN site_locales l ON l.code = t.locale
LEFT JOIN post_routes route ON route.translation_id = t.id AND route.is_canonical = 1;

DROP VIEW published_content;
CREATE VIEW published_content AS
SELECT t.content_id, c.kind, t.id AS translation_id, t.locale, l.lang_tag,
       route.route_path, '/' || t.locale || route.route_path AS path,
       r.id AS revision_id, r.revision_no, r.template_key, r.blocks_json, r.title,
       r.summary, r.body_markdown, r.seo_title, r.seo_description, r.noindex,
       r.cover_key, r.cover_alt, r.source_url, r.source_title, r.source_author,
       r.source_published_at_ms, p.first_published_at_ms, p.modified_at_ms
FROM content_publications p
JOIN content_translations t ON t.id = p.translation_id
JOIN content_items c ON c.id = t.content_id
JOIN site_locales l ON l.code = t.locale
JOIN content_revisions r ON r.translation_id = p.translation_id AND r.id = p.revision_id
JOIN content_revision_seals seal ON seal.revision_id = r.id
JOIN content_routes route ON route.translation_id = t.id AND route.locale = t.locale AND route.is_canonical = 1
WHERE p.is_live = 1 AND c.kind <> 'article'
UNION ALL
SELECT content_id, kind, translation_id, locale, lang_tag, route_path, path, revision_id,
       revision_no, template_key, blocks_json, title, summary, body_markdown, seo_title,
       seo_description, noindex, cover_key, cover_alt, source_url, source_title, source_author,
       source_published_at_ms, first_published_at_ms, modified_at_ms
FROM current_articles WHERE first_published_at_ms IS NOT NULL AND route_path IS NOT NULL;

DROP VIEW published_articles;
CREATE VIEW published_articles AS
SELECT * FROM current_articles WHERE first_published_at_ms IS NOT NULL AND route_path IS NOT NULL;

DROP VIEW publication_validation_errors;
CREATE VIEW publication_validation_errors AS
SELECT p.translation_id AS entity_id, 'missing_canonical_route' AS error_code
FROM content_publications p JOIN content_translations t ON t.id = p.translation_id
JOIN content_items c ON c.id = t.content_id AND c.kind <> 'article'
WHERE p.is_live = 1 AND NOT EXISTS (
    SELECT 1 FROM content_routes r WHERE r.translation_id = p.translation_id AND r.is_canonical = 1
)
UNION ALL
SELECT p.translation_id, 'unsealed_content_revision'
FROM content_publications p JOIN content_translations t ON t.id = p.translation_id
JOIN content_items c ON c.id = t.content_id AND c.kind <> 'article'
WHERE p.is_live = 1 AND NOT EXISTS (SELECT 1 FROM content_revision_seals WHERE revision_id = p.revision_id)
UNION ALL
SELECT translation_id, 'missing_canonical_route'
FROM current_articles WHERE first_published_at_ms IS NOT NULL AND route_path IS NULL;

CREATE VIEW public_topic_members AS
SELECT p.content_id AS topic_id, p.locale, p.managed, m.position, m.is_featured,
       a.content_id AS post_id, a.path, a.title, a.summary
FROM public_topics p
JOIN published_content c ON c.content_id = p.content_id AND c.locale = p.locale
JOIN collection_members m ON m.collection_revision_id = c.revision_id
JOIN reachable_articles a ON a.content_id = m.member_content_id AND a.locale = p.locale
WHERE p.managed = 0
UNION ALL
SELECT m.topic_id, a.locale, 1, m.sort_order, 0, a.content_id, a.path, a.title, a.summary
FROM topic_posts m JOIN reachable_articles a ON a.content_id = m.post_id;

CREATE TRIGGER topic_post_requires_article BEFORE INSERT ON topic_posts
WHEN NOT EXISTS (SELECT 1 FROM reachable_articles WHERE content_id = NEW.post_id)
BEGIN
    SELECT RAISE(ABORT, 'INVALID_TOPIC_ARTICLE');
END;

CREATE TRIGGER post_translation_delete_guard BEFORE DELETE ON post_translations
BEGIN
    SELECT RAISE(ABORT, 'ARTICLE_REQUIRED_BY_SITE') WHERE EXISTS (
        SELECT 1 FROM published_site s JOIN site_menu_items m ON m.site_revision_id = s.id
        WHERE s.locale = OLD.locale AND m.target_content_id = OLD.post_id AND m.missing_target_policy = 'error'
    ) OR EXISTS (
        SELECT 1 FROM published_content p JOIN collection_members m ON m.collection_revision_id = p.revision_id
        WHERE p.kind = 'collection' AND p.locale = OLD.locale
          AND m.member_content_id = OLD.post_id AND m.require_published = 1
    );
END;
CREATE TRIGGER post_translation_delete_cleanup AFTER DELETE ON post_translations
BEGIN
    INSERT INTO post_translation_revision_floors (post_id, locale, revision)
    SELECT OLD.post_id, OLD.locale, OLD.revision
    WHERE EXISTS (SELECT 1 FROM post_translations WHERE post_id = OLD.post_id)
    ON CONFLICT(post_id, locale) DO UPDATE SET revision = max(revision, excluded.revision);
    DELETE FROM posts WHERE id = OLD.post_id
      AND NOT EXISTS (SELECT 1 FROM post_translations WHERE post_id = OLD.post_id);
END;

PRAGMA foreign_key_check;
COMMIT;
