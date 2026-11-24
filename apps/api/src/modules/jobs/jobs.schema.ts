import { t } from "elysia";
import { errorResponse } from "../auth/auth.schema";
import { idSchema, localeSchema, slugSchema } from "../posts/posts.schema";

const dateTime = t.String({ format: "date-time" });
const nullableString = t.Nullable(t.String());
const revision = t.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER });

export const sourceRelationshipSchema = t.Union([
  t.Literal("public"),
  t.Literal("partner"),
  t.Literal("sponsored"),
]);

export const workModeSchema = t.Union([
  t.Literal("remote"),
  t.Literal("hybrid"),
  t.Literal("onsite"),
  t.Literal("unspecified"),
]);

export const employmentTypeSchema = t.Union([
  t.Literal("full_time"),
  t.Literal("part_time"),
  t.Literal("contract"),
  t.Literal("internship"),
  t.Literal("cofounder"),
  t.Literal("unspecified"),
]);

export const disclosureTypeSchema = t.Union([
  t.Literal("curated_public"),
  t.Literal("author_submitted"),
  t.Literal("sponsored"),
]);

export const jobStatusSchema = t.Union([
  t.Literal("draft"),
  t.Literal("open"),
  t.Literal("expired"),
  t.Literal("closed"),
  t.Literal("removed"),
]);

export const jobListViewSchema = t.Union([
  t.Literal("all_active"),
  t.Literal("needs_review"),
  t.Literal("draft"),
  t.Literal("archived"),
  t.Literal("removed"),
  t.Literal("all"),
]);

export const jobErrors = {
  400: errorResponse,
  401: errorResponse,
  403: errorResponse,
  404: errorResponse,
  409: errorResponse,
  500: errorResponse,
};

export const jobSourceResponse = t.Object({
  id: idSchema,
  platform: t.Literal("x"),
  handle: t.String(),
  displayName: t.String(),
  profileUrl: t.String(),
  bioZh: t.String(),
  bioEn: t.String(),
  relationship: sourceRelationshipSchema,
  optOut: t.Boolean(),
  optOutNote: t.String(),
  openCount: t.Integer(),
  totalCount: t.Integer(),
  removedCount: t.Integer(),
  createdAt: dateTime,
  updatedAt: dateTime,
});

export const jobSourceListQuery = t.Object(
  {
    search: t.Optional(t.String({ maxLength: 120 })),
    optOut: t.Optional(
      t.Union([t.Literal("all"), t.Literal("active"), t.Literal("blocked")]),
    ),
  },
  { additionalProperties: false },
);

export const jobSourceListResponse = t.Object({
  counts: t.Object({
    total: t.Integer(),
    active: t.Integer(),
    blocked: t.Integer(),
  }),
  items: t.Array(jobSourceResponse),
});

export const createJobSourceBody = t.Object(
  {
    handle: t.String({ minLength: 1, maxLength: 65, pattern: "\\S" }),
    displayName: t.String({ minLength: 1, maxLength: 120, pattern: "\\S" }),
    bioZh: t.Optional(t.String({ maxLength: 500 })),
    bioEn: t.Optional(t.String({ maxLength: 500 })),
    relationship: t.Optional(sourceRelationshipSchema),
    optOut: t.Optional(t.Boolean()),
    optOutNote: t.Optional(t.String({ maxLength: 500 })),
  },
  { additionalProperties: false },
);

export const updateJobSourceBody = t.Object(
  {
    displayName: t.Optional(
      t.String({ minLength: 1, maxLength: 120, pattern: "\\S" }),
    ),
    bioZh: t.Optional(t.String({ maxLength: 500 })),
    bioEn: t.Optional(t.String({ maxLength: 500 })),
    relationship: t.Optional(sourceRelationshipSchema),
    optOut: t.Optional(t.Boolean()),
    optOutNote: t.Optional(t.String({ maxLength: 500 })),
    takedownExistingJobs: t.Optional(t.Boolean()),
  },
  { minProperties: 1, additionalProperties: false },
);

export const parseUrlBody = t.Object(
  {
    url: t.String({ minLength: 1, maxLength: 1024, pattern: "\\S" }),
  },
  { additionalProperties: false },
);

export const parseUrlResponse = t.Object({
  handle: t.String(),
  statusId: t.String(),
  canonicalUrl: t.String(),
  profileUrl: t.String(),
  duplicateJob: t.Nullable(
    t.Object({
      id: idSchema,
      title: t.String(),
      status: jobStatusSchema,
    }),
  ),
  source: t.Nullable(jobSourceResponse),
  blockedByOptOut: t.Boolean(),
});

const jobTranslationFields = {
  title: t.String({ minLength: 1, maxLength: 200, pattern: "\\S" }),
  slug: slugSchema,
  summary: t.Optional(t.String({ maxLength: 500 })),
  content: t.String({ minLength: 1, maxLength: 100_000, pattern: "\\S" }),
  sourceExcerpt: t.Optional(t.String({ maxLength: 200 })),
  seoTitle: t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
  seoDescription: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
};

const applyUrlSchema = t.Nullable(
  t.Union([
    t.Literal(""),
    t.String({
      pattern: "^(https?://|mailto:)",
      maxLength: 2048,
    }),
  ]),
);

const jobSettingsFields = {
  sourcePostPublishedAt: t.Optional(dateTime),
  applyUrl: t.Optional(applyUrlSchema),
  workMode: t.Optional(workModeSchema),
  employmentType: t.Optional(employmentTypeSchema),
  locationText: t.Optional(t.String({ maxLength: 160 })),
  compensationText: t.Optional(t.String({ maxLength: 160 })),
  disclosureType: t.Optional(disclosureTypeSchema),
  status: t.Optional(jobStatusSchema),
  expiresAt: t.Optional(dateTime),
  isFeatured: t.Optional(t.Boolean()),
};

export const createJobBody = t.Object(
  {
    ...jobTranslationFields,
    ...jobSettingsFields,
    locale: localeSchema,
    sourcePostUrl: t.String({ minLength: 1, maxLength: 1024, pattern: "\\S" }),
    sourceId: t.Optional(idSchema),
    sourceDisplayName: t.Optional(t.String({ maxLength: 120 })),
  },
  { additionalProperties: false },
);

export const jobTranslationBody = t.Object(jobTranslationFields, {
  additionalProperties: false,
});

export const updateJobTranslationBody = t.Object(
  { ...jobTranslationFields, revision },
  { additionalProperties: false },
);

export const updateJobSettingsBody = t.Object(jobSettingsFields, {
  minProperties: 1,
  additionalProperties: false,
});

export const verifyJobBody = t.Optional(
  t.Object(
    {
      extendDays: t.Optional(t.Integer({ minimum: 1, maximum: 90 })),
    },
    { additionalProperties: false },
  ),
);

export const jobIdParams = t.Object({ id: idSchema });
export const jobTranslationParams = t.Object({
  id: idSchema,
  locale: localeSchema,
});

export const jobListQuery = t.Object(
  {
    view: t.Optional(jobListViewSchema),
    search: t.Optional(t.String({ maxLength: 200 })),
    disclosureType: t.Optional(disclosureTypeSchema),
    sourceId: t.Optional(idSchema),
    page: t.Optional(t.Numeric({ minimum: 1, maximum: 100_000, multipleOf: 1 })),
    pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 50, multipleOf: 1 })),
  },
  { additionalProperties: false },
);

const embeddedSource = t.Object({
  id: idSchema,
  handle: t.String(),
  displayName: t.String(),
  profileUrl: t.String(),
  relationship: sourceRelationshipSchema,
  optOut: t.Boolean(),
});

const jobTranslationRecord = t.Object({
  locale: localeSchema,
  slug: t.String(),
  title: t.String(),
  summary: t.String(),
  content: t.String(),
  sourceExcerpt: t.String(),
  seoTitle: nullableString,
  seoDescription: nullableString,
  revision,
  updatedAt: dateTime,
});

export const jobSummaryResponse = t.Object({
  id: idSchema,
  title: t.String(),
  slug: nullableString,
  primaryLocale: localeSchema,
  locales: t.Array(localeSchema),
  source: embeddedSource,
  sourcePostUrl: t.String(),
  sourcePostId: t.String(),
  sourcePostPublishedAt: dateTime,
  applyUrl: nullableString,
  workMode: workModeSchema,
  employmentType: employmentTypeSchema,
  locationText: t.String(),
  compensationText: t.String(),
  disclosureType: disclosureTypeSchema,
  status: jobStatusSchema,
  lastVerifiedAt: dateTime,
  expiresAt: dateTime,
  daysSinceVerified: t.Integer(),
  daysUntilExpiry: t.Integer(),
  needsReview: t.Boolean(),
  isExpiredByTime: t.Boolean(),
  isFeatured: t.Boolean(),
  createdAt: dateTime,
  updatedAt: dateTime,
});

export const jobListResponse = t.Object({
  summary: t.Object({
    open: t.Integer(),
    bilingualOpen: t.Integer(),
    needsReview: t.Integer(),
    draft: t.Integer(),
    archived: t.Integer(),
    removed: t.Integer(),
    sources: t.Integer(),
    optOutSources: t.Integer(),
  }),
  total: t.Integer(),
  page: t.Integer(),
  pageSize: t.Integer(),
  items: t.Array(jobSummaryResponse),
});

export const jobDetailResponse = t.Object({
  ...jobSummaryResponse.properties,
  translations: t.Array(jobTranslationRecord),
  activeTranslation: t.Nullable(jobTranslationRecord),
});

export const jobCreatedResponse = t.Object({
  id: idSchema,
  sourceId: idSchema,
});

export const jobTranslationSavedResponse = t.Object({
  id: idSchema,
  locale: localeSchema,
  revision,
});

export const jobVerifiedResponse = t.Object({
  id: idSchema,
  status: jobStatusSchema,
  lastVerifiedAt: dateTime,
  expiresAt: dateTime,
});
