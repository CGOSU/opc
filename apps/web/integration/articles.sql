-- Isolated fixture; never load into a developer or production content database.
INSERT INTO content_items (id, created_at_ms) VALUES ('fixture', 1), ('draft', 1), ('withdrawn', 1);
INSERT INTO content_translations VALUES
    ('guide-zh', 'fixture', 'zh', 1),
    ('guide-en', 'fixture', 'en', 1),
    ('draft-zh', 'draft', 'zh', 1),
    ('withdrawn-zh', 'withdrawn', 'zh', 1);
INSERT INTO content_revisions (
    id, translation_id, revision_no, title, summary, body_markdown, seo_title, seo_description,
    cover_key, cover_alt, source_author, created_at_ms
) VALUES
    ('r-zh', 'guide-zh', 1, 'Workers 指南', '中文文章摘要', '# 中文章节

原始 HTML 中可读取这段正文。

## 中文章节

[首页](/zh/) ![示意图](/goose-placeholder.svg)

> 这是一条引用。

| 项 | 值 |
| -- | -- |
| 运行时 | Workers |

```js
const ready = true;
```

<template>Forbidden HTML element</template>

[禁止链接](javascript:void%280%29)
', 'Workers 与 D1 指南', 'Workers 与 D1 整合测试摘要', 'goose-placeholder.svg', '封面图', '测试来源作者', 1),
    ('r-en', 'guide-en', 1, 'Reading in a Worker', 'English fixture & <XML> summary', 'English fixture body.',
        NULL, NULL, NULL, NULL, NULL, 1),
    ('r-draft', 'draft-zh', 1, 'Private draft title', '', 'Private draft body.',
        NULL, NULL, NULL, NULL, NULL, 1),
    ('r-withdrawn', 'withdrawn-zh', 1, 'Withdrawn item', '', 'Withdrawn private body.',
        NULL, NULL, NULL, NULL, NULL, 1),
    ('r-draft-edit', 'guide-zh', 2, 'Unpublished edit', '', 'Never expose draft edits.',
        NULL, NULL, NULL, NULL, NULL, 2);
INSERT INTO content_revision_seals VALUES ('r-zh', 1), ('r-en', 1), ('r-draft', 1), ('r-withdrawn', 1);
INSERT INTO content_publications VALUES
    ('guide-zh', 'r-zh', 1, 1704067200000, 1704153600000),
    ('guide-en', 'r-en', 1, 1704067200000, 1704067200000),
    ('withdrawn-zh', 'r-withdrawn', 0, 1704067200000, 1704153600000);
INSERT INTO content_routes (locale, route_path, translation_id, is_canonical, created_at_ms) VALUES
    ('zh', '/articles/workers-guide/', 'guide-zh', 1, 1),
    ('zh', '/articles/old-workers/', 'guide-zh', 0, 1),
    ('en', '/articles/worker-notes/', 'guide-en', 1, 1),
    ('zh', '/articles/draft/', 'draft-zh', 1, 1),
    ('zh', '/articles/withdrawn/', 'withdrawn-zh', 1, 1);

-- A public noindex article is readable, but must not be syndicated or indexed.
INSERT INTO content_items (id, created_at_ms) VALUES ('unlisted', 1);
INSERT INTO content_translations VALUES ('unlisted-zh', 'unlisted', 'zh', 1);
INSERT INTO content_revisions (
    id, translation_id, revision_no, title, summary, body_markdown, noindex, created_at_ms
) VALUES ('r-unlisted', 'unlisted-zh', 1, 'Unlisted note', '', 'Public but not indexed.', 1, 1);
INSERT INTO content_revision_seals VALUES ('r-unlisted', 1);
INSERT INTO content_publications VALUES ('unlisted-zh', 'r-unlisted', 1, 1703980800000, 1703980800000);
INSERT INTO content_routes (locale, route_path, translation_id, is_canonical, created_at_ms)
VALUES ('zh', '/articles/unlisted/', 'unlisted-zh', 1, 1);

-- Guides are translated independently and use different public slugs.
INSERT INTO content_items (id, created_at_ms, kind) VALUES
    ('series', 1, 'collection'), ('empty-series', 1, 'collection');
INSERT INTO content_translations VALUES
    ('series-zh', 'series', 'zh', 1), ('series-en', 'series', 'en', 1),
    ('empty-series-zh', 'empty-series', 'zh', 1);
INSERT INTO content_revisions (
    id, translation_id, revision_no, title, summary, body_markdown, created_at_ms, template_key
) VALUES
    ('series-r-zh', 'series-zh', 1, '边缘应用专题', '从应用模型到部署实践。', '先了解运行环境，再尝试部署。', 1, 'topic'),
    ('series-r-en', 'series-en', 1, 'Edge application study path', 'Study the runtime and then deploy.', '', 1, 'topic'),
    ('empty-series-r-zh', 'empty-series-zh', 1, 'Hidden collection', 'Only has a draft member.', '', 1, 'topic');

-- Six newer articles exercise the homepage limit and the non-duplicating featured section.
INSERT INTO content_items (id, created_at_ms)
SELECT 'lesson-' || value, 1 FROM json_each('[1,2,3,4,5,6]');
INSERT INTO content_translations
SELECT id || '-zh', id, 'zh', 1 FROM content_items WHERE id GLOB 'lesson-*';
INSERT INTO content_revisions (
    id, translation_id, revision_no, title, summary, body_markdown, created_at_ms
)
SELECT 'r-' || id, id, 1, '工程课 ' || content_id, '工程课摘要', '完整正文。', 1
FROM content_translations WHERE content_id GLOB 'lesson-*';
INSERT INTO content_revision_seals
SELECT id, 1 FROM content_revisions WHERE id GLOB 'r-lesson-*';
INSERT INTO content_publications
SELECT translation_id, id, 1, 1704153600000, 1704153600000
FROM content_revisions WHERE id GLOB 'r-lesson-*';
INSERT INTO content_routes (locale, route_path, translation_id, is_canonical, created_at_ms)
SELECT 'zh', '/articles/' || content_id || '/', id, 1, 1
FROM content_translations WHERE content_id GLOB 'lesson-*';

INSERT INTO collection_members VALUES
    ('series-r-zh', 'lesson-2', 10, 0, 0),
    ('series-r-zh', 'draft', 20, 0, 0),
    ('series-r-zh', 'fixture', 30, 1, 0),
    ('series-r-zh', 'lesson-1', 40, 0, 0),
    ('series-r-en', 'fixture', 10, 1, 0),
    ('empty-series-r-zh', 'draft', 10, 0, 0);
INSERT INTO content_revision_seals VALUES ('series-r-zh', 1), ('series-r-en', 1), ('empty-series-r-zh', 1);
INSERT INTO content_publications VALUES
    ('series-zh', 'series-r-zh', 1, 1704067200000, 1704067200000),
    ('series-en', 'series-r-en', 1, 1704067200000, 1704067200000),
    ('empty-series-zh', 'empty-series-r-zh', 1, 1704067200000, 1704067200000);
INSERT INTO content_routes (locale, route_path, translation_id, is_canonical, created_at_ms) VALUES
    ('zh', '/topics/edge/', 'series-zh', 1, 1),
    ('zh', '/topics/old-edge/', 'series-zh', 0, 1),
    ('en', '/topics/edge-learning/', 'series-en', 1, 1),
    ('zh', '/topics/empty/', 'empty-series-zh', 1, 1);
