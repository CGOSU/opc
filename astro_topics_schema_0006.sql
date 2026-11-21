-- Managed topics are independent of the existing sealed editorial collections.
BEGIN;

CREATE TABLE topics (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
    slug TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 120
        AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT GLOB '-*'
        AND slug NOT GLOB '*-' AND slug NOT GLOB '*--*'),
    description TEXT NOT NULL DEFAULT '',
    cover_image TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
) STRICT;

CREATE TABLE topic_posts (
    topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    post_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    PRIMARY KEY (topic_id, post_id),
    UNIQUE (topic_id, sort_order)
) STRICT;
CREATE INDEX topic_posts_by_post ON topic_posts (post_id, topic_id);

CREATE TRIGGER topic_post_requires_article BEFORE INSERT ON topic_posts
WHEN NOT EXISTS (SELECT 1 FROM published_articles WHERE content_id = NEW.post_id AND route_path GLOB '/articles/*/')
BEGIN
    SELECT RAISE(ABORT, 'INVALID_TOPIC_ARTICLE');
END;

CREATE TRIGGER topic_posts_cleanup AFTER DELETE ON content_translations
WHEN NOT EXISTS (SELECT 1 FROM content_translations WHERE content_id = OLD.content_id)
BEGIN
    DELETE FROM topic_posts WHERE post_id = OLD.content_id;
END;

-- Canonical and historical editorial URLs keep priority in both languages.
CREATE TRIGGER topic_slug_insert BEFORE INSERT ON topics
WHEN EXISTS (SELECT 1 FROM content_routes WHERE route_path = '/topics/' || NEW.slug || '/')
BEGIN
    SELECT RAISE(ABORT, 'DUPLICATE_TOPIC_SLUG');
END;
CREATE TRIGGER topic_slug_update BEFORE UPDATE OF slug ON topics
WHEN EXISTS (SELECT 1 FROM content_routes WHERE route_path = '/topics/' || NEW.slug || '/')
BEGIN
    SELECT RAISE(ABORT, 'DUPLICATE_TOPIC_SLUG');
END;
CREATE TRIGGER editorial_topic_route_insert BEFORE INSERT ON content_routes
WHEN EXISTS (SELECT 1 FROM topics WHERE NEW.route_path = '/topics/' || slug || '/')
BEGIN
    SELECT RAISE(ABORT, 'DUPLICATE_TOPIC_SLUG');
END;
CREATE TRIGGER editorial_topic_route_update BEFORE UPDATE OF route_path ON content_routes
WHEN EXISTS (SELECT 1 FROM topics WHERE NEW.route_path = '/topics/' || slug || '/')
BEGIN
    SELECT RAISE(ABORT, 'DUPLICATE_TOPIC_SLUG');
END;

-- Apply the same route eligibility to editorial collections and their members as Astro.
CREATE VIEW reachable_articles AS
SELECT * FROM (
    SELECT a.*, substr(route_path, 11, length(route_path) - 11) AS article_slug
    FROM published_articles a WHERE route_path GLOB '/articles/*/'
)
WHERE article_slug GLOB '[a-z0-9]*' AND article_slug NOT GLOB '*[^a-z0-9-]*'
  AND article_slug NOT GLOB '*--*' AND article_slug NOT GLOB '*-';

CREATE VIEW public_topics AS
SELECT p.content_id, p.locale, p.path, slug, p.title, p.summary, p.body_markdown,
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
SELECT t.id, l.code, '/' || l.code || '/topics/' || t.slug || '/', t.slug,
       t.title, t.description, '', NULL, NULL, 0, t.updated_at_ms,
       t.cover_image, t.sort_order, 1
FROM topics t CROSS JOIN site_locales l WHERE l.code IN ('zh', 'en');

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

COMMIT;
