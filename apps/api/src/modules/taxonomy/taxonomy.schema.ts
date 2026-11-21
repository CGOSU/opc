import { t } from "elysia";
import { errorResponse } from "../auth/auth.schema";
import { idSchema, localeSchema, slugSchema } from "../posts/posts.schema";

const nullableText = (maxLength: number) => t.Nullable(t.String({ maxLength }));
const fields = {
  name: t.String({ minLength: 1, maxLength: 100, pattern: "\\S" }),
  slug: slugSchema,
  description: t.String({ maxLength: 500 }),
  seoTitle: nullableText(160),
  seoDescription: nullableText(320),
};
const input = {
  name: fields.name,
  slug: fields.slug,
  description: t.Optional(fields.description),
  seoTitle: t.Optional(fields.seoTitle),
  seoDescription: t.Optional(fields.seoDescription),
};
const sortOrder = t.Integer({ minimum: -2147483648, maximum: 2147483647 });
const revision = t.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER });
export const termBody = t.Object(
  { ...input, locale: localeSchema, sortOrder: t.Optional(sortOrder) },
  { additionalProperties: false },
);
export const translationBody = t.Object(input, { additionalProperties: false });
export const translationUpdate = t.Object(
  { ...input, revision },
  { additionalProperties: false },
);
export const settingsBody = t.Object(
  { sortOrder },
  { additionalProperties: false },
);
export const termParams = t.Object({ id: idSchema });
export const translationParams = t.Object({
  ...termParams.properties,
  locale: localeSchema,
});
export const termListQuery = t.Object(
  {
    search: t.Optional(t.String({ maxLength: 100 })),
    language: t.Optional(
      t.Union([t.Literal("missing-en"), t.Literal("bilingual")]),
    ),
    page: t.Optional(
      t.Numeric({ minimum: 1, maximum: 1_000_000, multipleOf: 1 }),
    ),
    pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 50, multipleOf: 1 })),
  },
  { additionalProperties: false },
);
const count = t.Integer({ minimum: 0 });
export const termResponse = t.Object({
  ...termParams.properties,
  name: t.String(),
  legacy: t.Nullable(
    t.Object({ name: t.String(), slug: t.String(), description: t.String() }),
  ),
  translations: t.Array(
    t.Object({ locale: localeSchema, ...fields, revision }),
  ),
  sortOrder,
  articleCount: count,
  createdAt: t.String({ format: "date-time" }),
  updatedAt: t.String({ format: "date-time" }),
});
export const termListResponse = t.Object({
  items: t.Array(termResponse),
  total: count,
  counts: t.Object({ shared: count, zh: count, en: count }),
  page: t.Integer({ minimum: 1 }),
  pageSize: t.Integer({ minimum: 1 }),
});
export const termErrors = {
  400: errorResponse,
  401: errorResponse,
  403: errorResponse,
  404: errorResponse,
  409: errorResponse,
  500: errorResponse,
};
