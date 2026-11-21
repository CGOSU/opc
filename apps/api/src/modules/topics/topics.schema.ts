import { t } from "elysia";
import { idSchema, localeSchema, slugSchema } from "../posts/posts.schema";

const date = t.String({ format: "date-time" });
const translationFields = {
  title: t.String({ minLength: 1, maxLength: 200, pattern: "\\S" }),
  slug: slugSchema,
  description: t.Optional(t.String({ maxLength: 2000 })),
  seoTitle: t.Optional(t.Nullable(t.String({ maxLength: 160 }))),
  seoDescription: t.Optional(t.Nullable(t.String({ maxLength: 320 }))),
};
const settings = {
  coverImage: t.Optional(
    t.Nullable(
      t.String({ format: "uri", pattern: "^https?://", maxLength: 2048 }),
    ),
  ),
  sortOrder: t.Optional(
    t.Integer({ minimum: -2147483648, maximum: 2147483647 }),
  ),
};
export const topicBody = t.Object(
  { ...translationFields, ...settings, locale: localeSchema },
  { additionalProperties: false },
);
export const topicTranslation = t.Object(translationFields, {
  additionalProperties: false,
});
export const topicSettings = t.Object(settings, {
  additionalProperties: false,
  minProperties: 1,
});
export const topicLocaleParams = t.Object({
  id: idSchema,
  locale: localeSchema,
});
export const topicArticleIds = t.Array(idSchema, {
  uniqueItems: true,
  maxItems: 1000,
});
export const topicQuery = t.Object(
  {
    search: t.Optional(t.String({ maxLength: 200 })),
    page: t.Optional(
      t.Numeric({ minimum: 1, maximum: 100_000, multipleOf: 1 }),
    ),
    pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 50, multipleOf: 1 })),
  },
  { additionalProperties: false },
);

export const adminTopicQuery = t.Object(
  {
    ...topicQuery.properties,
    language: t.Optional(
      t.Union([t.Literal("missing-en"), t.Literal("bilingual")]),
    ),
    order: t.Optional(
      t.Union([
        t.Literal("custom"),
        t.Literal("updated"),
        t.Literal("created"),
      ]),
    ),
  },
  { additionalProperties: false },
);

const fields = {
  title: t.String(),
  slug: t.String(),
  description: t.String(),
  coverImage: t.Nullable(t.String()),
};
const topic = t.Object({
  ...fields,
  id: idSchema,
  sortOrder: t.Integer(),
  createdAt: date,
  updatedAt: date,
  articleCount: t.Integer(),
  publicPath: t.Nullable(t.String()),
  locales: t.Array(localeSchema),
});
const article = { title: t.String(), path: t.String() };
export const topicDetail = t.Object({
  ...topic.properties,
  articles: t.Array(
    t.Object({
      id: idSchema,
      title: t.String(),
      path: t.Nullable(t.String()),
      locales: t.Array(localeSchema),
    }),
  ),
  legacy: t.Nullable(
    t.Object({ title: t.String(), slug: t.String(), description: t.String() }),
  ),
  translations: t.Array(
    t.Object({
      locale: localeSchema,
      title: t.String(),
      slug: t.String(),
      description: t.String(),
      seoTitle: t.Nullable(t.String()),
      seoDescription: t.Nullable(t.String()),
      publishedAt: date,
    }),
  ),
});
const page = { page: t.Integer(), pageSize: t.Integer(), total: t.Integer() };
export const topicList = t.Object({ ...page, items: t.Array(topic) });
const publicTopic = t.Object({ ...fields, path: t.String(), updatedAt: date });
export const publicTopicList = t.Object({
  ...page,
  items: t.Array(publicTopic),
});
export const publicTopicDetail = t.Object({
  ...publicTopic.properties,
  articles: t.Array(t.Object({ ...article, summary: t.String() })),
});
