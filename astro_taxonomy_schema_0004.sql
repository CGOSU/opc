-- Taxonomy links use the stable, language-neutral content identity.
-- This migration does not classify or otherwise modify existing content.
CREATE TABLE categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) BETWEEN 1 AND 100),
    slug TEXT NOT NULL UNIQUE CHECK (
        length(slug) BETWEEN 1 AND 120
        AND slug NOT GLOB '*[^a-z0-9-]*'
        AND slug NOT GLOB '-*' AND slug NOT GLOB '*-' AND slug NOT GLOB '*--*'
    ),
    description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 500),
    sort_order INTEGER NOT NULL DEFAULT 0
        CHECK (sort_order BETWEEN -2147483648 AND 2147483647),
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
) STRICT;

CREATE INDEX idx_categories_order ON categories (sort_order, name);

CREATE TABLE tags (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) BETWEEN 1 AND 100),
    slug TEXT NOT NULL UNIQUE CHECK (
        length(slug) BETWEEN 1 AND 120
        AND slug NOT GLOB '*[^a-z0-9-]*'
        AND slug NOT GLOB '-*' AND slug NOT GLOB '*-' AND slug NOT GLOB '*--*'
    ),
    description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 500),
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
) STRICT;

CREATE TABLE post_categories (
    post_id TEXT PRIMARY KEY NOT NULL REFERENCES content_items (id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES categories (id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_post_categories_category ON post_categories (category_id);

CREATE TABLE post_tags (
    post_id TEXT NOT NULL REFERENCES content_items (id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
) STRICT;

CREATE INDEX idx_post_tags_tag ON post_tags (tag_id);
