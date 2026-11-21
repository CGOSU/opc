-- Isolated fixture for historical taxonomy routes retained by 0009.
INSERT INTO categories (id, name, slug, description, sort_order, created_at_ms, updated_at_ms)
VALUES ('fixture-category', 'Legacy cloud guide', 'legacy-cloud', 'Historical description', 3, 1, 1);
INSERT INTO tags (id, name, slug, description, created_at_ms, updated_at_ms)
VALUES ('fixture-tag', 'Legacy edge tag', 'legacy-edge', '', 1, 1);
INSERT INTO post_categories VALUES ('fixture', 'fixture-category');
INSERT INTO post_tags VALUES ('fixture', 'fixture-tag');
