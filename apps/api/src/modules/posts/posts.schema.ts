import { t } from "elysia";
import { errorResponse } from "../auth/auth.schema";

export const localeSchema = t.Union([t.Literal("zh"), t.Literal("en")]);
export const idSchema = t.String({ minLength: 1, maxLength: 200 });
export const slugSchema = t.String({
  minLength: 1,
  maxLength: 120,
  pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
});
const date = t.String({ format: "date-time" });
const tag = t.Object({ id: idSchema, name: t.String() });
const nullableString = t.Nullable(t.String());
const translation = {
  title: t.String({ minLength: 1, maxLength: 200, pattern: "\\S" }),
  slug: slugSchema,
  summary: t.Optional(t.String({ maxLength: 500 })),
  content: t.String({ minLength: 1, maxLength: 100_000, pattern: "\\S" }),
  seoTitle: t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
  seoDescription: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
};
const settings = {
  coverImage: t.Optional(
    t.Nullable(
      t.String({ format: "uri", pattern: "^https?://", maxLength: 2048 }),
    ),
  ),
  categoryId: t.Optional(t.Nullable(idSchema)),
  tagIds: t.Optional(t.Array(idSchema, { uniqueItems: true, maxItems: 100 })),
  topicIds: t.Optional(t.Array(idSchema, { uniqueItems: true, maxItems: 100 })),
};
export const createBody = t.Object(
  { ...translation, ...settings, locale: localeSchema },
  { additionalProperties: false },
);
const revision = t.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER });
export const translationBody = t.Object(translation, {
  additionalProperties: false,
});
export const updateTranslationBody = t.Object(
  { ...translation, revision },
  { additionalProperties: false },
);
export const settingsBody = t.Object(settings, {
  minProperties: 1,
  additionalProperties: false,
});
export const translationParams = t.Object({
  id: idSchema,
  locale: localeSchema,
});
export const translationSaved = t.Object({ id: idSchema, revision });
export const postParams = t.Object({ id: idSchema });
export const postErrors = {
  400: errorResponse,
  401: errorResponse,
  403: errorResponse,
  404: errorResponse,
  409: errorResponse,
  500: errorResponse,
};

const paging = {
  search: t.Optional(t.String({ maxLength: 200 })),
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 100_000, multipleOf: 1 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 50, multipleOf: 1 })),
  sort: t.Optional(t.Union([t.Literal("created"), t.Literal("updated")])),
  order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
};
export const adminQuery = t.Object(
  {
    ...paging,
    locale: t.Optional(localeSchema),
    categoryId: t.Optional(idSchema),
    tagId: t.Optional(idSchema),
    topicId: t.Optional(idSchema),
  },
  { additionalProperties: false },
);
export const publicQuery = t.Object(
  { ...paging, locale: t.Optional(localeSchema) },
  { additionalProperties: false },
);

export const publicPost = t.Object({
  title: t.String(),
  slug: t.String(),
  locale: localeSchema,
  summary: t.String(),
  path: t.String(),
  coverImage: nullableString,
  publishedAt: date,
  updatedAt: date,
  category: nullableString,
  tags: t.Array(t.String()),
});
const adminPost = t.Object({
  ...publicPost.properties,
  id: idSchema,
  contentId: idSchema,
  createdAt: date,
  categoryId: t.Nullable(idSchema),
  tags: t.Array(tag),
  topics: t.Array(t.Object({ id: idSchema, title: t.String() })),
  translations: t.Array(t.Object({ id: idSchema, locale: localeSchema })),
});
export const adminDetail = t.Object({
  ...adminPost.properties,
  slug: nullableString,
  path: nullableString,
  publishedAt: t.Nullable(date),
  content: t.String(),
  revision,
  seoTitle: nullableString,
  seoDescription: nullableString,
  sharedCoverImage: nullableString,
  usesLegacyCover: t.Boolean(),
});
export const publicDetail = t.Object({
  ...publicPost.properties,
  content: t.String(),
});
const pageFields = {
  total: t.Integer(),
  page: t.Integer(),
  pageSize: t.Integer(),
};
export const adminList = t.Object({ ...pageFields, items: t.Array(adminPost) });
export const publicList = t.Object({
  ...pageFields,
  items: t.Array(publicPost),
});
