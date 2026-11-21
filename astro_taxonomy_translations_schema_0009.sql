-- Preserve old names and bilingual URL coverage without inventing translations.
BEGIN;

ALTER TABLE categories RENAME TO categories_v1;
ALTER TABLE tags RENAME TO tags_v1;

CREATE TABLE categories (
    id TEXT PRIMARY KEY NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN -2147483648 AND 2147483647),
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
) STRICT;

CREATE TABLE legacy_categories (
    category_id TEXT PRIMARY KEY NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL
) STRICT;

CREATE TABLE category_translations (
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    locale TEXT NOT NULL REFERENCES site_locales(code),
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
    slug TEXT NOT NULL CHECK (length(slug) BETWEEN 1 AND 120
        AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT GLOB '-*'
        AND slug NOT GLOB '*-' AND slug NOT GLOB '*--*'),
    description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 500),
    seo_title TEXT CHECK (length(seo_title) <= 160),
    seo_description TEXT CHECK (length(seo_description) <= 320),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    PRIMARY KEY (category_id, locale),
    UNIQUE (locale, slug),
    UNIQUE (locale, name)
) STRICT;

INSERT INTO categories (id, sort_order, created_at_ms, updated_at_ms)
SELECT id, sort_order, created_at_ms, updated_at_ms FROM categories_v1;

INSERT INTO legacy_categories
SELECT id, name, slug, description FROM categories_v1;

CREATE TRIGGER category_translation_reserve_legacy_insert BEFORE INSERT ON category_translations
WHEN EXISTS (SELECT 1 FROM legacy_categories WHERE slug = NEW.slug AND category_id <> NEW.category_id)
BEGIN
    SELECT RAISE(ABORT, 'DUPLICATE_TERM');
END;

CREATE TRIGGER category_translation_reserve_legacy_update BEFORE UPDATE OF slug ON category_translations
WHEN EXISTS (SELECT 1 FROM legacy_categories WHERE slug = NEW.slug AND category_id <> NEW.category_id)
BEGIN
    SELECT RAISE(ABORT, 'DUPLICATE_TERM');
END;

-- The lookup view keeps legacy addresses available; the display view picks
-- a single label and canonical link per entity and locale.
CREATE VIEW category_routes AS
SELECT category_id AS id, locale, name, slug, description, seo_title, seo_description, 0 AS is_legacy
FROM category_translations
UNION ALL
SELECT category_id, l.code, name, slug, description, NULL, NULL, 1
FROM legacy_categories CROSS JOIN site_locales l WHERE l.code IN ('zh', 'en');

CREATE VIEW localized_categories AS
SELECT * FROM category_routes r
WHERE r.is_legacy = 0 OR NOT EXISTS (
    SELECT 1 FROM category_translations t WHERE t.category_id = r.id AND t.locale = r.locale
);

CREATE TABLE tags (
    id TEXT PRIMARY KEY NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN -2147483648 AND 2147483647),
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
) STRICT;

CREATE TABLE legacy_tags (
    tag_id TEXT PRIMARY KEY NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL
) STRICT;

CREATE TABLE tag_translations (
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    locale TEXT NOT NULL REFERENCES site_locales(code),
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
    slug TEXT NOT NULL CHECK (length(slug) BETWEEN 1 AND 120
        AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT GLOB '-*'
        AND slug NOT GLOB '*-' AND slug NOT GLOB '*--*'),
    description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 500),
    seo_title TEXT CHECK (length(seo_title) <= 160),
    seo_description TEXT CHECK (length(seo_description) <= 320),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    PRIMARY KEY (tag_id, locale),
    UNIQUE (locale, slug),
    UNIQUE (locale, name)
) STRICT;

INSERT INTO tags (id, sort_order, created_at_ms, updated_at_ms)
SELECT id, 0, created_at_ms, updated_at_ms FROM tags_v1;

INSERT INTO legacy_tags
SELECT id, name, slug, description FROM tags_v1;

CREATE TRIGGER tag_translation_reserve_legacy_insert BEFORE INSERT ON tag_translations
WHEN EXISTS (SELECT 1 FROM legacy_tags WHERE slug = NEW.slug AND tag_id <> NEW.tag_id)
BEGIN
    SELECT RAISE(ABORT, 'DUPLICATE_TERM');
END;

CREATE TRIGGER tag_translation_reserve_legacy_update BEFORE UPDATE OF slug ON tag_translations
WHEN EXISTS (SELECT 1 FROM legacy_tags WHERE slug = NEW.slug AND tag_id <> NEW.tag_id)
BEGIN
    SELECT RAISE(ABORT, 'DUPLICATE_TERM');
END;

-- The lookup view keeps legacy addresses available; the display view picks
-- a single label and canonical link per entity and locale.
CREATE VIEW tag_routes AS
SELECT tag_id AS id, locale, name, slug, description, seo_title, seo_description, 0 AS is_legacy
FROM tag_translations
UNION ALL
SELECT tag_id, l.code, name, slug, description, NULL, NULL, 1
FROM legacy_tags CROSS JOIN site_locales l WHERE l.code IN ('zh', 'en');

CREATE VIEW localized_tags AS
SELECT * FROM tag_routes r
WHERE r.is_legacy = 0 OR NOT EXISTS (
    SELECT 1 FROM tag_translations t WHERE t.tag_id = r.id AND t.locale = r.locale
);

-- Retarget the category FK without rebuilding posts and cascading through
-- translations and topic membership. The nullable FK can be added on live D1.
DROP INDEX posts_by_category;
ALTER TABLE posts ADD COLUMN category_id_next TEXT REFERENCES categories(id) ON DELETE RESTRICT;
UPDATE posts SET category_id_next = category_id WHERE category_id IS NOT NULL;
ALTER TABLE posts DROP COLUMN category_id;
ALTER TABLE posts RENAME COLUMN category_id_next TO category_id;
CREATE INDEX posts_by_category ON posts(category_id);

CREATE TABLE post_tags_v2 (
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
) STRICT;
INSERT INTO post_tags_v2 SELECT post_id, tag_id FROM post_tags;
DROP TABLE post_tags;
ALTER TABLE post_tags_v2 RENAME TO post_tags;
CREATE INDEX idx_post_tags_tag ON post_tags(tag_id);

DROP TABLE categories_v1;
DROP TABLE tags_v1;

PRAGMA foreign_key_check;
COMMIT;
