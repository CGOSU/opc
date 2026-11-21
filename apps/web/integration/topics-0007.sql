-- Managed topic without language tags in the old schema, with non-dense order.
INSERT INTO topics VALUES (
    'legacy-topic-id', 'Legacy runtime guide', 'legacy-runtime', 'Historical runtime notes.',
    'https://example.test/runtime-cover.jpg', 25, 1704067200000, 1704153600000
);
INSERT INTO topic_posts VALUES ('legacy-topic-id', 'lesson-2', 3), ('legacy-topic-id', 'fixture', 9);
