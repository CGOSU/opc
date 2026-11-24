import { sql, type SQL } from "drizzle-orm";
import { d1Batch, d1ErrorMessage } from "./batch";
import type { connectDb } from "./index";

type Db = ReturnType<typeof connectDb>;
export type JobLocale = "zh" | "en";
export type SourceRelationship = "public" | "partner" | "sponsored";
export type JobWorkMode = "remote" | "hybrid" | "onsite" | "unspecified";
export type JobEmploymentType =
  | "full_time"
  | "part_time"
  | "contract"
  | "internship"
  | "cofounder"
  | "unspecified";
export type JobDisclosureType =
  | "curated_public"
  | "author_submitted"
  | "sponsored";
export type JobStatus = "draft" | "open" | "expired" | "closed" | "removed";
export type JobListView =
  | "all_active"
  | "needs_review"
  | "draft"
  | "archived"
  | "removed"
  | "all";

export const REVIEW_THRESHOLD_MS = 14 * 86_400_000;
export const DEFAULT_EXPIRY_MS = 30 * 86_400_000;

export type JobWriteError =
  | "INVALID_SOURCE_URL"
  | "INVALID_HANDLE"
  | "SOURCE_NOT_FOUND"
  | "DUPLICATE_HANDLE"
  | "SOURCE_HAS_JOBS"
  | "SOURCE_OPTED_OUT"
  | "JOB_NOT_FOUND"
  | "DUPLICATE_SOURCE_URL"
  | "DUPLICATE_SLUG"
  | "DUPLICATE_LOCALE"
  | "REVISION_CONFLICT";

type WriteResult<T> = { ok: true; value: T } | { ok: false; code: JobWriteError };

const ok = <T>(value: T): WriteResult<T> => ({ ok: true, value });
const fail = (code: JobWriteError): WriteResult<never> => ({ ok: false, code });

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function toIso(ms: number) {
  return new Date(ms).toISOString();
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeHandle(raw: string): string | null {
  const cleaned = raw.trim().replace(/^@+/, "").toLowerCase();
  return /^[a-z0-9_]{1,64}$/.test(cleaned) ? cleaned : null;
}

export type ParsedXUrl = {
  handle: string;
  statusId: string;
  canonicalUrl: string;
  profileUrl: string;
};

const allowedXHosts = new Set([
  "x.com",
  "www.x.com",
  "mobile.x.com",
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com",
]);

export function parseXStatusUrl(rawUrl: string): ParsedXUrl | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!allowedXHosts.has(url.hostname.toLowerCase())) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  // Expect /{handle}/status/{id} (optionally followed by /photo/1 etc.)
  if (segments.length < 3) return null;
  const [rawHandle, kind, statusId] = segments;
  if (!rawHandle || kind?.toLowerCase() !== "status" || !statusId) return null;
  if (rawHandle.toLowerCase() === "i") return null;
  const handle = normalizeHandle(rawHandle);
  if (!handle || !/^\d{5,32}$/.test(statusId)) return null;
  return {
    handle,
    statusId,
    canonicalUrl: `https://x.com/${handle}/status/${statusId}`,
    profileUrl: `https://x.com/${handle}`,
  };
}

type SourceRow = {
  id: string;
  platform: "x";
  handle: string;
  display_name: string;
  profile_url: string;
  bio_zh: string;
  bio_en: string;
  relationship: SourceRelationship;
  opt_out: number;
  opt_out_note: string;
  created_at_ms: number;
  updated_at_ms: number;
  open_count?: number;
  total_count?: number;
  removed_count?: number;
};

export type JobSourceRecord = {
  id: string;
  platform: "x";
  handle: string;
  displayName: string;
  profileUrl: string;
  bioZh: string;
  bioEn: string;
  relationship: SourceRelationship;
  optOut: boolean;
  optOutNote: string;
  openCount: number;
  totalCount: number;
  removedCount: number;
  createdAt: string;
  updatedAt: string;
};

function mapSource(row: SourceRow): JobSourceRecord {
  return {
    id: row.id,
    platform: row.platform,
    handle: row.handle,
    displayName: row.display_name,
    profileUrl: row.profile_url,
    bioZh: row.bio_zh,
    bioEn: row.bio_en,
    relationship: row.relationship,
    optOut: row.opt_out === 1,
    optOutNote: row.opt_out_note,
    openCount: Number(row.open_count ?? 0),
    totalCount: Number(row.total_count ?? 0),
    removedCount: Number(row.removed_count ?? 0),
    createdAt: toIso(row.created_at_ms),
    updatedAt: toIso(row.updated_at_ms),
  };
}

export async function parseJobUrlCheck(db: Db, rawUrl: string) {
  const parsed = parseXStatusUrl(rawUrl);
  if (!parsed) return fail("INVALID_SOURCE_URL");

  const [existingJob, existingSource] = await Promise.all([
    db.get<{ id: string; status: JobStatus; title: string | null }>(sql`
      SELECT j.id, j.status,
        coalesce(
          (SELECT title FROM job_translations WHERE job_id = j.id AND locale = 'zh'),
          (SELECT title FROM job_translations WHERE job_id = j.id ORDER BY locale LIMIT 1)
        ) AS title
      FROM jobs j
      WHERE j.source_post_id = ${parsed.statusId} OR j.source_post_url = ${parsed.canonicalUrl}
      LIMIT 1
    `),
    db.get<SourceRow>(sql`
      SELECT s.*,
        (SELECT count(*) FROM jobs WHERE source_id = s.id AND status = 'open') AS open_count,
        (SELECT count(*) FROM jobs WHERE source_id = s.id) AS total_count,
        (SELECT count(*) FROM jobs WHERE source_id = s.id AND status = 'removed') AS removed_count
      FROM job_sources s
      WHERE s.handle = ${parsed.handle}
      LIMIT 1
    `),
  ]);

  const source = existingSource ? mapSource(existingSource) : null;
  return ok({
    ...parsed,
    duplicateJob: existingJob
      ? {
          id: existingJob.id,
          title: existingJob.title ?? parsed.canonicalUrl,
          status: existingJob.status,
        }
      : null,
    source,
    blockedByOptOut: source?.optOut ?? false,
  });
}

export async function listJobSources(
  db: Db,
  query: { search?: string; optOut?: "all" | "active" | "blocked" } = {},
) {
  const conditions: SQL[] = [];
  if (query.optOut === "active") conditions.push(sql`s.opt_out = 0`);
  if (query.optOut === "blocked") conditions.push(sql`s.opt_out = 1`);
  const search = query.search?.trim();
  if (search) {
    const pattern = `%${escapeLike(search.toLowerCase())}%`;
    conditions.push(sql`(
      lower(s.handle) LIKE ${pattern} ESCAPE '\\'
      OR lower(s.display_name) LIKE ${pattern} ESCAPE '\\'
      OR lower(s.bio_zh) LIKE ${pattern} ESCAPE '\\'
      OR lower(s.bio_en) LIKE ${pattern} ESCAPE '\\'
    )`);
  }
  const where = conditions.length
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``;

  const [rows, counts] = await Promise.all([
    db.all<SourceRow>(sql`
      SELECT s.*,
        (SELECT count(*) FROM jobs WHERE source_id = s.id AND status = 'open') AS open_count,
        (SELECT count(*) FROM jobs WHERE source_id = s.id) AS total_count,
        (SELECT count(*) FROM jobs WHERE source_id = s.id AND status = 'removed') AS removed_count
      FROM job_sources s
      ${where}
      ORDER BY s.opt_out ASC, open_count DESC, s.updated_at_ms DESC
    `),
    db.get<{ total: number; active: number; blocked: number }>(sql`
      SELECT
        count(*) AS total,
        coalesce(sum(CASE WHEN opt_out = 0 THEN 1 ELSE 0 END), 0) AS active,
        coalesce(sum(CASE WHEN opt_out = 1 THEN 1 ELSE 0 END), 0) AS blocked
      FROM job_sources
    `),
  ]);

  return {
    counts: counts ?? { total: 0, active: 0, blocked: 0 },
    items: rows.map(mapSource),
  };
}

export type CreateJobSourceInput = {
  handle: string;
  displayName: string;
  bioZh?: string;
  bioEn?: string;
  relationship?: SourceRelationship;
  optOut?: boolean;
  optOutNote?: string;
};

export async function createJobSource(db: Db, input: CreateJobSourceInput) {
  const handle = normalizeHandle(input.handle);
  if (!handle) return fail("INVALID_HANDLE");
  const id = makeId("src");
  const now = Date.now();
  const displayName = input.displayName.trim();
  const profileUrl = `https://x.com/${handle}`;
  const bioZh = (input.bioZh ?? "").trim();
  const bioEn = (input.bioEn ?? "").trim();
  const relationship: SourceRelationship = input.relationship ?? "public";
  const optOut = input.optOut ? 1 : 0;
  const optOutNote = (input.optOutNote ?? "").trim();

  try {
    await db.run(sql`
      INSERT INTO job_sources (
        id, platform, handle, display_name, profile_url,
        bio_zh, bio_en, relationship, opt_out, opt_out_note,
        created_at_ms, updated_at_ms
      ) VALUES (
        ${id}, 'x', ${handle}, ${displayName}, ${profileUrl},
        ${bioZh}, ${bioEn}, ${relationship}, ${optOut}, ${optOutNote},
        ${now}, ${now}
      )
    `);
  } catch (error) {
    if (d1ErrorMessage(error).includes("job_sources.handle")) {
      return fail("DUPLICATE_HANDLE");
    }
    throw error;
  }

  const created = await db.get<SourceRow>(sql`
    SELECT s.*, 0 AS open_count, 0 AS total_count, 0 AS removed_count
    FROM job_sources s WHERE s.id = ${id}
  `);
  if (!created) throw new Error("Created job source could not be read back.");
  return ok(mapSource(created));
}

export type UpdateJobSourceInput = {
  displayName?: string;
  bioZh?: string;
  bioEn?: string;
  relationship?: SourceRelationship;
  optOut?: boolean;
  optOutNote?: string;
  takedownExistingJobs?: boolean;
};

export async function updateJobSource(
  db: Db,
  id: string,
  input: UpdateJobSourceInput,
) {
  const existing = await db.get<SourceRow>(
    sql`SELECT * FROM job_sources WHERE id = ${id}`,
  );
  if (!existing) return fail("SOURCE_NOT_FOUND");

  const now = Date.now();
  const displayName =
    input.displayName !== undefined
      ? input.displayName.trim()
      : existing.display_name;
  const bioZh = input.bioZh !== undefined ? input.bioZh.trim() : existing.bio_zh;
  const bioEn = input.bioEn !== undefined ? input.bioEn.trim() : existing.bio_en;
  const relationship = input.relationship ?? existing.relationship;
  const optOut =
    input.optOut !== undefined ? (input.optOut ? 1 : 0) : existing.opt_out;
  const optOutNote =
    input.optOutNote !== undefined
      ? input.optOutNote.trim()
      : existing.opt_out_note;

  const statements: SQL[] = [
    sql`
      UPDATE job_sources
      SET display_name = ${displayName},
          bio_zh = ${bioZh},
          bio_en = ${bioEn},
          relationship = ${relationship},
          opt_out = ${optOut},
          opt_out_note = ${optOutNote},
          updated_at_ms = ${now}
      WHERE id = ${id}
    `,
  ];

  if (optOut === 1 && input.takedownExistingJobs) {
    statements.push(sql`
      UPDATE jobs
      SET status = 'removed', updated_at_ms = ${now}
      WHERE source_id = ${id} AND status <> 'removed'
    `);
  }

  await d1Batch(db, statements);

  const updated = await db.get<SourceRow>(sql`
    SELECT s.*,
      (SELECT count(*) FROM jobs WHERE source_id = s.id AND status = 'open') AS open_count,
      (SELECT count(*) FROM jobs WHERE source_id = s.id) AS total_count,
      (SELECT count(*) FROM jobs WHERE source_id = s.id AND status = 'removed') AS removed_count
    FROM job_sources s WHERE s.id = ${id}
  `);
  if (!updated) return fail("SOURCE_NOT_FOUND");
  return ok(mapSource(updated));
}

export async function deleteJobSource(db: Db, id: string) {
  const existing = await db.get<{ id: string }>(
    sql`SELECT id FROM job_sources WHERE id = ${id}`,
  );
  if (!existing) return fail("SOURCE_NOT_FOUND");
  const linked = await db.get<{ count: number }>(
    sql`SELECT count(*) AS count FROM jobs WHERE source_id = ${id}`,
  );
  if (Number(linked?.count ?? 0) > 0) return fail("SOURCE_HAS_JOBS");
  await db.run(sql`DELETE FROM job_sources WHERE id = ${id}`);
  return ok({ id });
}

type JobRow = {
  id: string;
  source_id: string;
  source_handle: string;
  source_display_name: string;
  source_profile_url: string;
  source_relationship: SourceRelationship;
  source_opt_out: number;
  source_post_url: string;
  source_post_id: string;
  source_post_published_at_ms: number;
  apply_url: string | null;
  work_mode: JobWorkMode;
  employment_type: JobEmploymentType;
  location_text: string;
  compensation_text: string;
  disclosure_type: JobDisclosureType;
  status: JobStatus;
  last_verified_at_ms: number;
  expires_at_ms: number;
  is_featured: number;
  created_at_ms: number;
  updated_at_ms: number;
  primary_title: string | null;
  primary_slug: string | null;
  primary_locale: JobLocale | null;
  has_zh: number;
  has_en: number;
};

type TranslationRow = {
  job_id: string;
  locale: JobLocale;
  slug: string;
  title: string;
  summary: string;
  content_md: string;
  source_excerpt: string;
  seo_title: string | null;
  seo_description: string | null;
  revision: number;
  updated_at_ms: number;
};

function mapJobSummary(row: JobRow, now: number) {
  const daysSinceVerified = Math.max(
    0,
    Math.floor((now - row.last_verified_at_ms) / 86_400_000),
  );
  const daysUntilExpiry = Math.ceil((row.expires_at_ms - now) / 86_400_000);
  const isExpiredByTime = row.status === "open" && row.expires_at_ms <= now;
  const needsReview =
    row.status === "open" &&
    (now - row.last_verified_at_ms >= REVIEW_THRESHOLD_MS || isExpiredByTime);

  const locales: JobLocale[] = [];
  if (row.has_zh === 1) locales.push("zh");
  if (row.has_en === 1) locales.push("en");

  return {
    id: row.id,
    title: row.primary_title ?? row.source_post_url,
    slug: row.primary_slug,
    primaryLocale: row.primary_locale ?? ("zh" as JobLocale),
    locales,
    source: {
      id: row.source_id,
      handle: row.source_handle,
      displayName: row.source_display_name,
      profileUrl: row.source_profile_url,
      relationship: row.source_relationship,
      optOut: row.source_opt_out === 1,
    },
    sourcePostUrl: row.source_post_url,
    sourcePostId: row.source_post_id,
    sourcePostPublishedAt: toIso(row.source_post_published_at_ms),
    applyUrl: row.apply_url,
    workMode: row.work_mode,
    employmentType: row.employment_type,
    locationText: row.location_text,
    compensationText: row.compensation_text,
    disclosureType: row.disclosure_type,
    status: row.status,
    lastVerifiedAt: toIso(row.last_verified_at_ms),
    expiresAt: toIso(row.expires_at_ms),
    daysSinceVerified,
    daysUntilExpiry,
    needsReview,
    isExpiredByTime,
    isFeatured: row.is_featured === 1,
    createdAt: toIso(row.created_at_ms),
    updatedAt: toIso(row.updated_at_ms),
  };
}

export async function listJobs(
  db: Db,
  query: {
    view?: JobListView;
    search?: string;
    disclosureType?: JobDisclosureType;
    sourceId?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const now = Date.now();
  const reviewCutoff = now - REVIEW_THRESHOLD_MS;
  const view: JobListView = query.view ?? "all_active";
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const conditions: SQL[] = [];
  if (view === "all_active") {
    conditions.push(sql`j.status = 'open'`);
  } else if (view === "needs_review") {
    conditions.push(
      sql`j.status = 'open' AND (j.last_verified_at_ms <= ${reviewCutoff} OR j.expires_at_ms <= ${now})`,
    );
  } else if (view === "draft") {
    conditions.push(sql`j.status = 'draft'`);
  } else if (view === "archived") {
    conditions.push(sql`j.status IN ('expired', 'closed')`);
  } else if (view === "removed") {
    conditions.push(sql`j.status = 'removed'`);
  }

  if (query.disclosureType) {
    conditions.push(sql`j.disclosure_type = ${query.disclosureType}`);
  }
  if (query.sourceId) {
    conditions.push(sql`j.source_id = ${query.sourceId}`);
  }
  const search = query.search?.trim();
  if (search) {
    const pattern = `%${escapeLike(search.toLowerCase())}%`;
    conditions.push(sql`(
      lower(s.handle) LIKE ${pattern} ESCAPE '\\'
      OR lower(s.display_name) LIKE ${pattern} ESCAPE '\\'
      OR lower(j.source_post_id) LIKE ${pattern} ESCAPE '\\'
      OR lower(j.location_text) LIKE ${pattern} ESCAPE '\\'
      OR EXISTS (
        SELECT 1 FROM job_translations jt
        WHERE jt.job_id = j.id
          AND (lower(jt.title) LIKE ${pattern} ESCAPE '\\' OR lower(jt.slug) LIKE ${pattern} ESCAPE '\\')
      )
    )`);
  }

  const where = conditions.length
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``;

  const [summaryRow, totalRow, rows] = await Promise.all([
    db.get<{
      open: number;
      bilingual_open: number;
      needs_review: number;
      draft: number;
      archived: number;
      removed: number;
      sources: number;
      opt_out_sources: number;
    }>(sql`
      SELECT
        (SELECT count(*) FROM jobs WHERE status = 'open') AS open,
        (SELECT count(*) FROM jobs j WHERE j.status = 'open'
          AND EXISTS (SELECT 1 FROM job_translations WHERE job_id = j.id AND locale = 'zh')
          AND EXISTS (SELECT 1 FROM job_translations WHERE job_id = j.id AND locale = 'en')
        ) AS bilingual_open,
        (SELECT count(*) FROM jobs WHERE status = 'open' AND (last_verified_at_ms <= ${reviewCutoff} OR expires_at_ms <= ${now})) AS needs_review,
        (SELECT count(*) FROM jobs WHERE status = 'draft') AS draft,
        (SELECT count(*) FROM jobs WHERE status IN ('expired', 'closed')) AS archived,
        (SELECT count(*) FROM jobs WHERE status = 'removed') AS removed,
        (SELECT count(*) FROM job_sources) AS sources,
        (SELECT count(*) FROM job_sources WHERE opt_out = 1) AS opt_out_sources
    `),
    db.get<{ total: number }>(sql`
      SELECT count(*) AS total
      FROM jobs j
      JOIN job_sources s ON s.id = j.source_id
      ${where}
    `),
    db.all<JobRow>(sql`
      SELECT j.*,
        s.handle AS source_handle,
        s.display_name AS source_display_name,
        s.profile_url AS source_profile_url,
        s.relationship AS source_relationship,
        s.opt_out AS source_opt_out,
        coalesce(
          (SELECT title FROM job_translations WHERE job_id = j.id AND locale = 'zh'),
          (SELECT title FROM job_translations WHERE job_id = j.id ORDER BY locale LIMIT 1)
        ) AS primary_title,
        coalesce(
          (SELECT slug FROM job_translations WHERE job_id = j.id AND locale = 'zh'),
          (SELECT slug FROM job_translations WHERE job_id = j.id ORDER BY locale LIMIT 1)
        ) AS primary_slug,
        CASE
          WHEN EXISTS (SELECT 1 FROM job_translations WHERE job_id = j.id AND locale = 'zh') THEN 'zh'
          ELSE 'en'
        END AS primary_locale,
        CASE WHEN EXISTS (SELECT 1 FROM job_translations WHERE job_id = j.id AND locale = 'zh') THEN 1 ELSE 0 END AS has_zh,
        CASE WHEN EXISTS (SELECT 1 FROM job_translations WHERE job_id = j.id AND locale = 'en') THEN 1 ELSE 0 END AS has_en
      FROM jobs j
      JOIN job_sources s ON s.id = j.source_id
      ${where}
      ORDER BY
        CASE WHEN j.status = 'open' AND (j.last_verified_at_ms <= ${reviewCutoff} OR j.expires_at_ms <= ${now}) THEN 0 ELSE 1 END ASC,
        j.is_featured DESC,
        j.updated_at_ms DESC,
        j.id ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `),
  ]);

  return {
    summary: {
      open: Number(summaryRow?.open ?? 0),
      bilingualOpen: Number(summaryRow?.bilingual_open ?? 0),
      needsReview: Number(summaryRow?.needs_review ?? 0),
      draft: Number(summaryRow?.draft ?? 0),
      archived: Number(summaryRow?.archived ?? 0),
      removed: Number(summaryRow?.removed ?? 0),
      sources: Number(summaryRow?.sources ?? 0),
      optOutSources: Number(summaryRow?.opt_out_sources ?? 0),
    },
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    items: rows.map((row) => mapJobSummary(row, now)),
  };
}

function mapTranslation(row: TranslationRow) {
  return {
    locale: row.locale,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    content: row.content_md,
    sourceExcerpt: row.source_excerpt,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    revision: row.revision,
    updatedAt: toIso(row.updated_at_ms),
  };
}

export async function getJob(db: Db, id: string, preferredLocale?: JobLocale) {
  const now = Date.now();
  const [row, translations] = await Promise.all([
    db.get<JobRow>(sql`
      SELECT j.*,
        s.handle AS source_handle,
        s.display_name AS source_display_name,
        s.profile_url AS source_profile_url,
        s.relationship AS source_relationship,
        s.opt_out AS source_opt_out,
        coalesce(
          (SELECT title FROM job_translations WHERE job_id = j.id AND locale = 'zh'),
          (SELECT title FROM job_translations WHERE job_id = j.id ORDER BY locale LIMIT 1)
        ) AS primary_title,
        coalesce(
          (SELECT slug FROM job_translations WHERE job_id = j.id AND locale = 'zh'),
          (SELECT slug FROM job_translations WHERE job_id = j.id ORDER BY locale LIMIT 1)
        ) AS primary_slug,
        CASE
          WHEN EXISTS (SELECT 1 FROM job_translations WHERE job_id = j.id AND locale = 'zh') THEN 'zh'
          ELSE 'en'
        END AS primary_locale,
        CASE WHEN EXISTS (SELECT 1 FROM job_translations WHERE job_id = j.id AND locale = 'zh') THEN 1 ELSE 0 END AS has_zh,
        CASE WHEN EXISTS (SELECT 1 FROM job_translations WHERE job_id = j.id AND locale = 'en') THEN 1 ELSE 0 END AS has_en
      FROM jobs j
      JOIN job_sources s ON s.id = j.source_id
      WHERE j.id = ${id}
    `),
    db.all<TranslationRow>(sql`
      SELECT * FROM job_translations WHERE job_id = ${id} ORDER BY locale DESC
    `),
  ]);

  if (!row) return null;

  const active = preferredLocale
    ? translations.find((t) => t.locale === preferredLocale) ?? null
    : translations.find((t) => t.locale === "zh") ?? translations[0] ?? null;

  if (preferredLocale && !active) return null;

  return {
    ...mapJobSummary(row, now),
    translations: translations.map(mapTranslation),
    activeTranslation: active ? mapTranslation(active) : null,
  };
}

export type JobTranslationInput = {
  title: string;
  slug: string;
  summary?: string;
  content: string;
  sourceExcerpt?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export type JobSettingsInput = {
  sourcePostPublishedAt?: string;
  applyUrl?: string | null;
  workMode?: JobWorkMode;
  employmentType?: JobEmploymentType;
  locationText?: string;
  compensationText?: string;
  disclosureType?: JobDisclosureType;
  status?: JobStatus;
  expiresAt?: string;
  isFeatured?: boolean;
};

export type CreateJobInput = JobTranslationInput &
  JobSettingsInput & {
    locale: JobLocale;
    sourcePostUrl: string;
    sourceId?: string;
    sourceDisplayName?: string;
  };

function parseTimestamp(iso: string | undefined, fallback: number) {
  if (!iso) return fallback;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function mapConstraintError(error: unknown): JobWriteError | null {
  const message = d1ErrorMessage(error);
  if (
    message.includes("jobs.source_post_url") ||
    message.includes("jobs.source_post_id")
  ) {
    return "DUPLICATE_SOURCE_URL";
  }
  if (message.includes("job_translations.locale, job_translations.slug")) {
    return "DUPLICATE_SLUG";
  }
  if (message.includes("job_translations.job_id, job_translations.locale")) {
    return "DUPLICATE_LOCALE";
  }
  return null;
}

export async function createJob(db: Db, input: CreateJobInput) {
  const parsed = parseXStatusUrl(input.sourcePostUrl);
  if (!parsed) return fail("INVALID_SOURCE_URL");

  const now = Date.now();
  let source = input.sourceId
    ? await db.get<SourceRow>(
        sql`SELECT * FROM job_sources WHERE id = ${input.sourceId}`,
      )
    : await db.get<SourceRow>(
        sql`SELECT * FROM job_sources WHERE handle = ${parsed.handle}`,
      );

  if (input.sourceId && !source) return fail("SOURCE_NOT_FOUND");
  if (source?.opt_out === 1) return fail("SOURCE_OPTED_OUT");

  const statements: SQL[] = [];
  let sourceId = source?.id;
  if (!sourceId) {
    sourceId = makeId("src");
    const displayName =
      input.sourceDisplayName?.trim() || `@${parsed.handle}`;
    const relationship: SourceRelationship =
      input.disclosureType === "author_submitted"
        ? "partner"
        : input.disclosureType === "sponsored"
          ? "sponsored"
          : "public";
    statements.push(sql`
      INSERT INTO job_sources (
        id, platform, handle, display_name, profile_url,
        bio_zh, bio_en, relationship, opt_out, opt_out_note,
        created_at_ms, updated_at_ms
      ) VALUES (
        ${sourceId}, 'x', ${parsed.handle}, ${displayName}, ${parsed.profileUrl},
        '', '', ${relationship}, 0, '',
        ${now}, ${now}
      )
    `);
  }

  const jobId = makeId("job");
  const publishedAtMs = parseTimestamp(input.sourcePostPublishedAt, now);
  const expiresAtMs = parseTimestamp(input.expiresAt, now + DEFAULT_EXPIRY_MS);
  const applyUrl = emptyToNull(input.applyUrl);
  const workMode: JobWorkMode = input.workMode ?? "unspecified";
  const employmentType: JobEmploymentType =
    input.employmentType ?? "unspecified";
  const locationText = (input.locationText ?? "").trim();
  const compensationText = (input.compensationText ?? "").trim();
  const disclosureType: JobDisclosureType =
    input.disclosureType ?? "curated_public";
  const status: JobStatus = input.status ?? "open";
  const isFeatured = input.isFeatured ? 1 : 0;

  statements.push(sql`
    INSERT INTO jobs (
      id, source_id, source_post_url, source_post_id, source_post_published_at_ms,
      apply_url, work_mode, employment_type, location_text, compensation_text,
      disclosure_type, status, last_verified_at_ms, expires_at_ms, is_featured,
      created_at_ms, updated_at_ms
    ) VALUES (
      ${jobId}, ${sourceId}, ${parsed.canonicalUrl}, ${parsed.statusId}, ${publishedAtMs},
      ${applyUrl}, ${workMode}, ${employmentType}, ${locationText}, ${compensationText},
      ${disclosureType}, ${status}, ${now}, ${expiresAtMs}, ${isFeatured},
      ${now}, ${now}
    )
  `);

  statements.push(sql`
    INSERT INTO job_translations (
      job_id, locale, slug, title, summary, content_md, source_excerpt,
      seo_title, seo_description, revision, updated_at_ms
    ) VALUES (
      ${jobId}, ${input.locale}, ${input.slug}, ${input.title.trim()},
      ${(input.summary ?? "").trim()}, ${input.content.trim()},
      ${(input.sourceExcerpt ?? "").trim()}, ${emptyToNull(input.seoTitle)},
      ${emptyToNull(input.seoDescription)}, 1, ${now}
    )
  `);

  try {
    await d1Batch(db, statements);
  } catch (error) {
    const mapped = mapConstraintError(error);
    if (mapped) return fail(mapped);
    throw error;
  }

  return ok({ id: jobId, sourceId });
}

export async function createJobTranslation(
  db: Db,
  jobId: string,
  locale: JobLocale,
  input: JobTranslationInput,
) {
  const existing = await db.get<{ id: string }>(
    sql`SELECT id FROM jobs WHERE id = ${jobId}`,
  );
  if (!existing) return fail("JOB_NOT_FOUND");

  const now = Date.now();
  try {
    await d1Batch(db, [
      sql`
        INSERT INTO job_translations (
          job_id, locale, slug, title, summary, content_md, source_excerpt,
          seo_title, seo_description, revision, updated_at_ms
        ) VALUES (
          ${jobId}, ${locale}, ${input.slug}, ${input.title.trim()},
          ${(input.summary ?? "").trim()}, ${input.content.trim()},
          ${(input.sourceExcerpt ?? "").trim()}, ${emptyToNull(input.seoTitle)},
          ${emptyToNull(input.seoDescription)}, 1, ${now}
        )
      `,
      sql`UPDATE jobs SET updated_at_ms = ${now} WHERE id = ${jobId}`,
    ]);
  } catch (error) {
    const mapped = mapConstraintError(error);
    if (mapped) return fail(mapped);
    throw error;
  }

  return ok({ id: jobId, locale, revision: 1 });
}

export async function updateJobTranslation(
  db: Db,
  jobId: string,
  locale: JobLocale,
  revision: number,
  input: JobTranslationInput,
) {
  const now = Date.now();
  const nextRevision = revision + 1;
  try {
    const result = await db.run(sql`
      UPDATE job_translations
      SET slug = ${input.slug},
          title = ${input.title.trim()},
          summary = ${(input.summary ?? "").trim()},
          content_md = ${input.content.trim()},
          source_excerpt = ${(input.sourceExcerpt ?? "").trim()},
          seo_title = ${emptyToNull(input.seoTitle)},
          seo_description = ${emptyToNull(input.seoDescription)},
          revision = ${nextRevision},
          updated_at_ms = ${now}
      WHERE job_id = ${jobId} AND locale = ${locale} AND revision = ${revision}
    `);
    if (!result.meta.changes) {
      const exists = await db.get<{ id: string }>(
        sql`SELECT id FROM jobs WHERE id = ${jobId}`,
      );
      return fail(exists ? "REVISION_CONFLICT" : "JOB_NOT_FOUND");
    }
    await db.run(sql`UPDATE jobs SET updated_at_ms = ${now} WHERE id = ${jobId}`);
  } catch (error) {
    const mapped = mapConstraintError(error);
    if (mapped) return fail(mapped);
    throw error;
  }

  return ok({ id: jobId, locale, revision: nextRevision });
}

export async function updateJobSettings(
  db: Db,
  jobId: string,
  input: JobSettingsInput,
) {
  const existing = await db.get<
    Pick<
      JobRow,
      | "id"
      | "source_opt_out"
      | "source_post_published_at_ms"
      | "apply_url"
      | "work_mode"
      | "employment_type"
      | "location_text"
      | "compensation_text"
      | "disclosure_type"
      | "status"
      | "expires_at_ms"
      | "is_featured"
    >
  >(sql`
    SELECT j.id, s.opt_out AS source_opt_out,
      j.source_post_published_at_ms, j.apply_url, j.work_mode,
      j.employment_type, j.location_text, j.compensation_text,
      j.disclosure_type, j.status, j.expires_at_ms, j.is_featured
    FROM jobs j
    JOIN job_sources s ON s.id = j.source_id
    WHERE j.id = ${jobId}
  `);
  if (!existing) return fail("JOB_NOT_FOUND");

  const nextStatus = input.status ?? existing.status;
  if (nextStatus === "open" && existing.source_opt_out === 1) {
    return fail("SOURCE_OPTED_OUT");
  }

  const now = Date.now();
  const publishedAtMs =
    input.sourcePostPublishedAt !== undefined
      ? parseTimestamp(
          input.sourcePostPublishedAt,
          existing.source_post_published_at_ms,
        )
      : existing.source_post_published_at_ms;
  const expiresAtMs =
    input.expiresAt !== undefined
      ? parseTimestamp(input.expiresAt, existing.expires_at_ms)
      : existing.expires_at_ms;
  const applyUrl =
    input.applyUrl !== undefined ? emptyToNull(input.applyUrl) : existing.apply_url;
  const workMode = input.workMode ?? existing.work_mode;
  const employmentType = input.employmentType ?? existing.employment_type;
  const locationText =
    input.locationText !== undefined
      ? input.locationText.trim()
      : existing.location_text;
  const compensationText =
    input.compensationText !== undefined
      ? input.compensationText.trim()
      : existing.compensation_text;
  const disclosureType = input.disclosureType ?? existing.disclosure_type;
  const isFeatured =
    input.isFeatured !== undefined
      ? input.isFeatured
        ? 1
        : 0
      : existing.is_featured;

  await db.run(sql`
    UPDATE jobs
    SET source_post_published_at_ms = ${publishedAtMs},
        apply_url = ${applyUrl},
        work_mode = ${workMode},
        employment_type = ${employmentType},
        location_text = ${locationText},
        compensation_text = ${compensationText},
        disclosure_type = ${disclosureType},
        status = ${nextStatus},
        expires_at_ms = ${expiresAtMs},
        is_featured = ${isFeatured},
        updated_at_ms = ${now}
    WHERE id = ${jobId}
  `);

  return ok({ id: jobId });
}

export async function verifyJob(db: Db, jobId: string, extendDays = 14) {
  const existing = await db.get<{
    id: string;
    status: JobStatus;
    expires_at_ms: number;
    source_opt_out: number;
  }>(sql`
    SELECT j.id, j.status, j.expires_at_ms, s.opt_out AS source_opt_out
    FROM jobs j
    JOIN job_sources s ON s.id = j.source_id
    WHERE j.id = ${jobId}
  `);
  if (!existing) return fail("JOB_NOT_FOUND");
  if (existing.source_opt_out === 1) return fail("SOURCE_OPTED_OUT");

  const now = Date.now();
  const nextStatus: JobStatus =
    existing.status === "expired" ? "open" : existing.status;
  const nextExpiresAt =
    Math.max(existing.expires_at_ms, now) + extendDays * 86_400_000;

  await db.run(sql`
    UPDATE jobs
    SET status = ${nextStatus},
        last_verified_at_ms = ${now},
        expires_at_ms = ${nextExpiresAt},
        updated_at_ms = ${now}
    WHERE id = ${jobId}
  `);

  return ok({
    id: jobId,
    status: nextStatus,
    lastVerifiedAt: toIso(now),
    expiresAt: toIso(nextExpiresAt),
  });
}

export async function deleteJob(db: Db, jobId: string) {
  const result = await db.run(sql`DELETE FROM jobs WHERE id = ${jobId}`);
  if (!result.meta.changes) return fail("JOB_NOT_FOUND");
  return ok({ id: jobId });
}
