-- Managed topics have shared settings, real translations, and ordered posts.
-- Old language-neutral copy continues to serve its original addresses.
BEGIN;

DROP VIEW public_topic_members;
DROP VIEW public_topics;
DROP TRIGGER topic_post_requires_article;
DROP TRIGGER topic_slug_insert;
DROP TRIGGER topic_slug_update;
DROP TRIGGER editorial_topic_route_insert;
DROP TRIGGER editorial_topic_route_update;
DROP TRIGGER post_route_reserve;
DROP TRIGGER topic_slug_reserve_post_insert;
DROP TRIGGER topic_slug_reserve_post_update;

ALTER TABLE topics RENAME TO topics_v1;
ALTER TABLE topic_posts RENAME TO topic_posts_v1;

CREATE TABLE topics (
    id TEXT PRIMARY KEY NOT NULL,
    cover_image TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN -2147483648 AND 2147483647),
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
) STRICT;

CREATE TABLE legacy_topics (
    topic_id TEXT PRIMARY KEY NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL
) STRICT;

CREATE TABLE topic_translations (
    topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    locale TEXT NOT NULL REFERENCES site_locales(code),
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
    slug TEXT NOT NULL CHECK (length(slug) BETWEEN 1 AND 120
        AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT GLOB '-*'
        AND slug NOT GLOB '*-' AND slug NOT GLOB '*--*'),
    description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
    seo_title TEXT CHECK (length(seo_title) <= 160),
    seo_description TEXT CHECK (length(seo_description) <= 320),
    published_at INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    PRIMARY KEY (topic_id, locale),
    UNIQUE (locale, slug)
) STRICT;

CREATE TABLE topic_posts (
    topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    PRIMARY KEY (topic_id, post_id),
    UNIQUE (topic_id, sort_order)
) STRICT;

INSERT INTO topics SELECT id, cover_image, sort_order, created_at_ms, updated_at_ms FROM topics_v1;
INSERT INTO legacy_topics SELECT id, title, slug, description FROM topics_v1;
INSERT INTO topic_posts SELECT topic_id, post_id, sort_order FROM topic_posts_v1;
DROP TABLE topic_posts_v1;
DROP TABLE topics_v1;
CREATE INDEX topic_posts_by_post ON topic_posts(post_id, topic_id);

CREATE TRIGGER topic_post_requires_article BEFORE INSERT ON topic_posts
WHEN NOT EXISTS (SELECT 1 FROM reachable_articles WHERE content_id = NEW.post_id)
BEGIN
    SELECT RAISE(ABORT, 'INVALID_TOPIC_ARTICLE');
END;

-- The old global slug remains reserved in both published languages. Real
-- translations claim only their locale; editorial and article routes share it.
CREATE VIEW managed_topic_routes AS
SELECT topic_id, locale, slug FROM topic_translations
UNION
SELECT topic_id, l.code, slug FROM legacy_topics CROSS JOIN site_locales l WHERE l.code IN ('zh', 'en');

CREATE TRIGGER topic_translation_route_insert BEFORE INSERT ON topic_translations
WHEN EXISTS (SELECT 1 FROM managed_topic_routes WHERE locale = NEW.locale AND slug = NEW.slug AND topic_id <> NEW.topic_id)
  OR EXISTS (SELECT 1 FROM content_routes WHERE locale = NEW.locale AND route_path = '/topics/' || NEW.slug || '/')
  OR EXISTS (SELECT 1 FROM post_routes WHERE locale = NEW.locale AND route_path = '/topics/' || NEW.slug || '/')
BEGIN
    SELECT RAISE(ABORT, 'DUPLICATE_TOPIC_SLUG');
END;
CREATE TRIGGER topic_translation_route_update BEFORE UPDATE OF slug ON topic_translations
WHEN EXISTS (SELECT 1 FROM managed_topic_routes WHERE locale = NEW.locale AND slug = NEW.slug AND topic_id <> NEW.topic_id)
  OR EXISTS (SELECT 1 FROM content_routes WHERE locale = NEW.locale AND route_path = '/topics/' || NEW.slug || '/')
  OR EXISTS (SELECT 1 FROM post_routes WHERE locale = NEW.locale AND route_path = '/topics/' || NEW.slug || '/')
BEGIN
    SELECT RAISE(ABORT, 'DUPLICATE_TOPIC_SLUG');
END;
CREATE TRIGGER editorial_topic_route_insert BEFORE INSERT ON content_routes
WHEN EXISTS (SELECT 1 FROM managed_topic_routes WHERE locale = NEW.locale AND NEW.route_path = '/topics/' || slug || '/')
BEGIN
    SELECT RAISE(ABORT, 'DUPLICATE_TOPIC_SLUG');
END;
CREATE TRIGGER editorial_topic_route_update BEFORE UPDATE OF locale, route_path ON content_routes
WHEN EXISTS (SELECT 1 FROM managed_topic_routes WHERE locale = NEW.locale AND NEW.route_path = '/topics/' || slug || '/')
BEGIN
    SELECT RAISE(ABORT, 'DUPLICATE_TOPIC_SLUG');
END;
CREATE TRIGGER post_route_reserve BEFORE INSERT ON post_routes
WHEN EXISTS (SELECT 1 FROM content_routes WHERE locale = NEW.locale AND route_path = NEW.route_path)
   OR EXISTS (SELECT 1 FROM managed_topic_routes WHERE locale = NEW.locale AND NEW.route_path = '/topics/' || slug || '/')
BEGIN
    SELECT RAISE(ABORT, 'DUPLICATE_ARTICLE_SLUG');
END;

CREATE VIEW admin_topic_labels AS
SELECT t.id, coalesce(tr.title, legacy.title, t.id) AS title,
       coalesce(tr.slug, legacy.slug, '') AS slug,
       coalesce(tr.description, legacy.description, '') AS description
FROM topics t
LEFT JOIN legacy_topics legacy ON legacy.topic_id = t.id
LEFT JOIN topic_translations tr ON tr.topic_id = t.id AND tr.locale = (
    SELECT locale FROM topic_translations WHERE topic_id = t.id ORDER BY locale DESC LIMIT 1
);

CREATE VIEW public_topics AS
SELECT p.content_id, p.locale, p.path, p.slug, p.title, p.summary, p.body_markdown,
       p.seo_title, p.seo_description, p.noindex, p.modified_at_ms,
       NULL AS cover_image, 0 AS sort_order, 0 AS managed
FROM (
    SELECT *, substr(route_path, 9, length(route_path) - 9) AS slug
    FROM published_content WHERE kind = 'collection' AND route_path GLOB '/topics/*/'
) p
WHERE p.slug GLOB '[a-z0-9]*' AND p.slug NOT GLOB '*[^a-z0-9-]*'
  AND p.slug NOT GLOB '*--*' AND p.slug NOT GLOB '*-'
  AND (trim(p.summary) <> '' OR trim(p.body_markdown) <> '')
  AND EXISTS (SELECT 1 FROM collection_members m JOIN reachable_articles a
      ON a.content_id = m.member_content_id AND a.locale = p.locale
      WHERE m.collection_revision_id = p.revision_id)
UNION ALL
SELECT t.id, tr.locale, '/' || tr.locale || '/topics/' || tr.slug || '/', tr.slug,
       tr.title, tr.description, '', tr.seo_title, tr.seo_description, 0,
       max(t.updated_at_ms, tr.updated_at_ms), t.cover_image, t.sort_order, 1
FROM topics t JOIN topic_translations tr ON tr.topic_id = t.id
UNION ALL
SELECT t.id, l.code, '/' || l.code || '/topics/' || legacy.slug || '/', legacy.slug,
       legacy.title, legacy.description, '', NULL, NULL, 0, t.updated_at_ms,
       t.cover_image, t.sort_order, 1
FROM topics t JOIN legacy_topics legacy ON legacy.topic_id = t.id
CROSS JOIN site_locales l WHERE l.code IN ('zh', 'en') AND NOT EXISTS (
    SELECT 1 FROM topic_translations tr WHERE tr.topic_id = t.id AND tr.locale = l.code
);

CREATE VIEW public_topic_routes AS
SELECT topic_id, locale, slug, 1 AS managed FROM managed_topic_routes
UNION ALL
SELECT tr.content_id, r.locale, substr(r.route_path, 9, length(r.route_path) - 9), 0
FROM content_routes r JOIN content_translations tr ON tr.id = r.translation_id
WHERE r.route_path GLOB '/topics/*/';

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
FROM topic_posts m JOIN reachable_articles a ON a.content_id = m.post_id
JOIN public_topics p ON p.managed = 1 AND p.content_id = m.topic_id AND p.locale = a.locale;

PRAGMA foreign_key_check;
COMMIT;
