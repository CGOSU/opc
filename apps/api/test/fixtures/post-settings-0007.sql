-- Add persisted relations and required references to the shared legacy article fixture.
INSERT INTO categories (id, name, slug, created_at_ms, updated_at_ms)
VALUES ('old-category', 'Runtime', 'runtime', 1, 1);
INSERT INTO tags (id, name, slug, created_at_ms, updated_at_ms)
VALUES ('old-tag', 'Workers', 'workers', 1, 1);
INSERT INTO post_categories VALUES ('fixture', 'old-category');
INSERT INTO post_tags VALUES ('fixture', 'old-tag');
INSERT INTO topics VALUES ('old-topic', 'Runtime group', 'runtime-group', '', NULL, 0, 1, 1);
INSERT INTO topic_posts VALUES ('old-topic', 'lesson-1', 0), ('old-topic', 'fixture', 1);
INSERT INTO article_revision_covers VALUES
  ('r-zh', 'https://assets.example.test/old-zh.png'),
  ('r-en', 'https://assets.example.test/old-en.png');

INSERT INTO site_revisions (id, locale, revision_no, site_name, created_at_ms)
VALUES ('old-site', 'zh', 1, 'Legacy site', 1);
INSERT INTO site_menu_items (site_revision_id, slot, item_key, label, position, target_kind, target_content_id)
VALUES ('old-site', 'header_primary', 'guide', '指南', 0, 'internal', 'fixture');
UPDATE site_revisions SET sealed_at_ms = 1 WHERE id = 'old-site';
INSERT INTO site_publications VALUES ('zh', 'old-site', 1);

-- Separate required member with no menu reference, to exercise both delete guards.
INSERT INTO content_items (id, created_at_ms, kind) VALUES ('required-series', 1, 'collection');
INSERT INTO content_translations VALUES ('required-series-zh', 'required-series', 'zh', 1);
INSERT INTO content_revisions (id, translation_id, revision_no, title, summary, body_markdown, created_at_ms, template_key)
VALUES ('required-series-r', 'required-series-zh', 1, 'Required series', 'Fixture', '', 1, 'topic');
INSERT INTO collection_members VALUES ('required-series-r', 'lesson-1', 0, 0, 1);
INSERT INTO content_revision_seals VALUES ('required-series-r', 1);
INSERT INTO content_publications VALUES ('required-series-zh', 'required-series-r', 1, 1, 1);
INSERT INTO content_routes (locale, route_path, translation_id, is_canonical, created_at_ms)
VALUES ('zh', '/topics/required-series/', 'required-series-zh', 1, 1);

INSERT INTO content_items (id, created_at_ms) VALUES ('empty-language', 1);
INSERT INTO content_translations VALUES ('empty-en', 'empty-language', 'en', 1);
