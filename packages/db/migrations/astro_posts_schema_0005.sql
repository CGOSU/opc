-- Article administration extends the existing bilingual publishing model in place.
BEGIN;

CREATE TABLE article_revision_covers (
    revision_id TEXT PRIMARY KEY NOT NULL REFERENCES content_revisions(id) ON DELETE CASCADE,
    url TEXT NOT NULL CHECK (url GLOB 'https://*' OR url GLOB 'http://*')
) STRICT;

-- Ordinary edits still cannot delete immutable revisions or seals. Only deletion
-- of their owning article translation can remove them through the trigger below.
DROP TRIGGER content_revisions_no_delete;
CREATE TRIGGER content_revisions_no_delete BEFORE DELETE ON content_revisions
WHEN EXISTS (SELECT 1 FROM content_translations WHERE id = OLD.translation_id)
BEGIN
    SELECT RAISE(ABORT, 'Delete the owning article translation instead.');
END;

DROP TRIGGER content_revision_seals_no_delete;
CREATE TRIGGER content_revision_seals_no_delete BEFORE DELETE ON content_revision_seals
WHEN EXISTS (
    SELECT 1 FROM content_revisions r JOIN content_translations t ON t.id = r.translation_id
    WHERE r.id = OLD.revision_id
)
BEGIN
    SELECT RAISE(ABORT, 'Delete the owning article translation instead.');
END;

CREATE TRIGGER article_translation_delete AFTER DELETE ON content_translations
WHEN EXISTS (SELECT 1 FROM content_items WHERE id = OLD.content_id AND kind = 'article')
BEGIN
    SELECT RAISE(ABORT, 'ARTICLE_REQUIRED_BY_SITE') WHERE
        EXISTS (
            SELECT 1 FROM published_site s
            JOIN site_menu_items m ON m.site_revision_id = s.id
            WHERE s.locale = OLD.locale AND m.target_content_id = OLD.content_id
              AND m.missing_target_policy = 'error'
        ) OR EXISTS (
            SELECT 1 FROM published_content p
            JOIN collection_members m ON m.collection_revision_id = p.revision_id
            WHERE p.kind = 'collection' AND p.locale = OLD.locale
              AND m.member_content_id = OLD.content_id AND m.require_published = 1
        );
    DELETE FROM content_routes WHERE translation_id = OLD.id;
    DELETE FROM content_publications WHERE translation_id = OLD.id;
    DELETE FROM content_revision_seals WHERE revision_id IN (
        SELECT id FROM content_revisions WHERE translation_id = OLD.id
    );
    DELETE FROM content_revisions WHERE translation_id = OLD.id;
    DELETE FROM post_tags WHERE post_id = OLD.content_id
      AND NOT EXISTS (SELECT 1 FROM content_translations WHERE content_id = OLD.content_id);
    DELETE FROM post_categories WHERE post_id = OLD.content_id
      AND NOT EXISTS (SELECT 1 FROM content_translations WHERE content_id = OLD.content_id);
    -- Historical sealed site/collection snapshots may still reference the identity.
    -- Keep only that identity in this case, never its deleted URLs or content.
    DELETE FROM content_items WHERE id = OLD.content_id
      AND NOT EXISTS (SELECT 1 FROM content_translations WHERE content_id = OLD.content_id)
      AND NOT EXISTS (SELECT 1 FROM site_menu_items WHERE target_content_id = OLD.content_id)
      AND NOT EXISTS (SELECT 1 FROM collection_members WHERE member_content_id = OLD.content_id);
END;

-- Historical URLs remain locale-scoped as before. Newly claimed article URLs
-- may share a slug only between translations of the same content identity.
CREATE TRIGGER article_slug_insert BEFORE INSERT ON content_routes
WHEN NEW.route_path GLOB '/articles/*/' AND EXISTS (
    SELECT 1 FROM content_routes r
    JOIN content_translations existing ON existing.id = r.translation_id
    JOIN content_translations incoming ON incoming.id = NEW.translation_id
    JOIN content_items c ON c.id = incoming.content_id AND c.kind = 'article'
    WHERE r.route_path = NEW.route_path AND existing.content_id <> incoming.content_id
) AND NOT EXISTS (
    SELECT 1 FROM content_routes r WHERE r.locale = NEW.locale AND r.route_path = NEW.route_path
      AND r.translation_id = NEW.translation_id
)
BEGIN
    SELECT RAISE(ABORT, 'DUPLICATE_ARTICLE_SLUG');
END;

COMMIT;
