import { connectDb } from "@opc/db";
import {
  createJob,
  createJobSource,
  createJobTranslation,
  deleteJob,
  deleteJobSource,
  getJob,
  listJobs,
  listJobSources,
  parseJobUrlCheck,
  updateJobSettings,
  updateJobSource,
  updateJobTranslation,
  verifyJob,
  type JobWriteError,
} from "@opc/db/jobs";
import { Elysia, status, ValidationError } from "elysia";
import { adminSecurity } from "../../plugins/admin-security";
import { authError } from "../auth/auth.schema";
import {
  createJobBody,
  createJobSourceBody,
  jobCreatedResponse,
  jobDetailResponse,
  jobErrors,
  jobIdParams,
  jobListQuery,
  jobListResponse,
  jobSourceListQuery,
  jobSourceListResponse,
  jobSourceResponse,
  jobTranslationBody,
  jobTranslationParams,
  jobTranslationSavedResponse,
  jobVerifiedResponse,
  parseUrlBody,
  parseUrlResponse,
  updateJobSettingsBody,
  updateJobSourceBody,
  updateJobTranslationBody,
  verifyJobBody,
} from "./jobs.schema";

const errors: Record<JobWriteError, readonly [400 | 404 | 409, string]> = {
  INVALID_SOURCE_URL: [
    400,
    "请输入有效的 X / Twitter 推文链接（例如 https://x.com/handle/status/123456）。",
  ],
  INVALID_HANDLE: [
    400,
    "博主 X 账号仅支持字母、数字与下划线（1–64 字符）。",
  ],
  SOURCE_NOT_FOUND: [404, "未找到对应的博主档案。"],
  DUPLICATE_HANDLE: [409, "该 X 博主账号已在博主库中。"],
  SOURCE_HAS_JOBS: [409, "该博主仍有已收录的招聘条目，无法删除。"],
  SOURCE_OPTED_OUT: [
    409,
    "该博主已列入不收录拒收名单（opt_out），系统已阻止录入或重新上架。",
  ],
  JOB_NOT_FOUND: [404, "未找到对应的招聘条目或语言版本。"],
  DUPLICATE_SOURCE_URL: [409, "该 X 原推文链接已被收录，请勿重复录入。"],
  DUPLICATE_SLUG: [409, "同语言下已存在相同的招聘 Slug。"],
  DUPLICATE_LOCALE: [409, "该招聘条目的当前语言版本已存在。"],
  REVISION_CONFLICT: [
    409,
    "当前语言版本已被更新或不存在，请刷新最新版本后重试。",
  ],
};

function failure(code: JobWriteError) {
  const [httpStatus, message] = errors[code];
  return status(httpStatus, authError(code, message));
}

function strictWriteBody<T extends { properties: Record<string, unknown> }>(
  schema: T,
) {
  return ({ body }: { body: unknown }) => {
    if (
      body &&
      typeof body === "object" &&
      Object.keys(body).some((key) => !Object.hasOwn(schema.properties, key))
    ) {
      throw new ValidationError("body", schema as never, body);
    }
  };
}

export function jobRoutes(getEnv: () => Cloudflare.Env) {
  const db = () => connectDb(getEnv().CONTENT);

  return new Elysia({ prefix: "/api/admin/jobs" })
    .use(adminSecurity(getEnv))
    .post(
      "/parse-url",
      async ({ body }) => {
        const result = await parseJobUrlCheck(db(), body.url);
        return result.ok ? result.value : failure(result.code);
      },
      {
        requireSession: true,
        body: parseUrlBody,
        transform: strictWriteBody(parseUrlBody),
        response: { 200: parseUrlResponse, ...jobErrors },
      },
    )
    .get("/", ({ query }) => listJobs(db(), query), {
      requireSession: true,
      query: jobListQuery,
      response: { 200: jobListResponse, ...jobErrors },
    })
    .post(
      "/",
      async ({ body }) => {
        const saved = await createJob(db(), body);
        return saved.ok ? status(201, saved.value) : failure(saved.code);
      },
      {
        requireSession: true,
        body: createJobBody,
        transform: strictWriteBody(createJobBody),
        response: { 201: jobCreatedResponse, ...jobErrors },
      },
    )
    .get(
      "/:id",
      async ({ params }) =>
        (await getJob(db(), params.id)) ?? failure("JOB_NOT_FOUND"),
      {
        requireSession: true,
        params: jobIdParams,
        response: { 200: jobDetailResponse, ...jobErrors },
      },
    )
    .get(
      "/:id/translations/:locale",
      async ({ params }) =>
        (await getJob(db(), params.id, params.locale)) ??
        failure("JOB_NOT_FOUND"),
      {
        requireSession: true,
        params: jobTranslationParams,
        response: { 200: jobDetailResponse, ...jobErrors },
      },
    )
    .post(
      "/:id/translations/:locale",
      async ({ params, body }) => {
        const saved = await createJobTranslation(
          db(),
          params.id,
          params.locale,
          body,
        );
        return saved.ok ? status(201, saved.value) : failure(saved.code);
      },
      {
        requireSession: true,
        params: jobTranslationParams,
        body: jobTranslationBody,
        transform: strictWriteBody(jobTranslationBody),
        response: { 201: jobTranslationSavedResponse, ...jobErrors },
      },
    )
    .put(
      "/:id/translations/:locale",
      async ({ params, body: { revision, ...fields } }) => {
        const saved = await updateJobTranslation(
          db(),
          params.id,
          params.locale,
          revision,
          fields,
        );
        return saved.ok ? saved.value : failure(saved.code);
      },
      {
        requireSession: true,
        params: jobTranslationParams,
        body: updateJobTranslationBody,
        transform: strictWriteBody(updateJobTranslationBody),
        response: { 200: jobTranslationSavedResponse, ...jobErrors },
      },
    )
    .patch(
      "/:id/settings",
      async ({ params, body }) => {
        const saved = await updateJobSettings(db(), params.id, body);
        return saved.ok ? saved.value : failure(saved.code);
      },
      {
        requireSession: true,
        params: jobIdParams,
        body: updateJobSettingsBody,
        transform: strictWriteBody(updateJobSettingsBody),
        response: { 200: jobIdParams, ...jobErrors },
      },
    )
    .post(
      "/:id/verify",
      async ({ params, body }) => {
        const saved = await verifyJob(db(), params.id, body?.extendDays ?? 14);
        return saved.ok ? saved.value : failure(saved.code);
      },
      {
        requireSession: true,
        params: jobIdParams,
        body: verifyJobBody,
        response: { 200: jobVerifiedResponse, ...jobErrors },
      },
    )
    .delete(
      "/:id",
      async ({ params }) => {
        const removed = await deleteJob(db(), params.id);
        return removed.ok ? removed.value : failure(removed.code);
      },
      {
        requireSession: true,
        params: jobIdParams,
        response: { 200: jobIdParams, ...jobErrors },
      },
    );
}

export function jobSourceRoutes(getEnv: () => Cloudflare.Env) {
  const db = () => connectDb(getEnv().CONTENT);

  return new Elysia({ prefix: "/api/admin/job-sources" })
    .use(adminSecurity(getEnv))
    .get("/", ({ query }) => listJobSources(db(), query), {
      requireSession: true,
      query: jobSourceListQuery,
      response: { 200: jobSourceListResponse, ...jobErrors },
    })
    .post(
      "/",
      async ({ body }) => {
        const saved = await createJobSource(db(), body);
        return saved.ok ? status(201, saved.value) : failure(saved.code);
      },
      {
        requireSession: true,
        body: createJobSourceBody,
        transform: strictWriteBody(createJobSourceBody),
        response: { 201: jobSourceResponse, ...jobErrors },
      },
    )
    .patch(
      "/:id",
      async ({ params, body }) => {
        const saved = await updateJobSource(db(), params.id, body);
        return saved.ok ? saved.value : failure(saved.code);
      },
      {
        requireSession: true,
        params: jobIdParams,
        body: updateJobSourceBody,
        transform: strictWriteBody(updateJobSourceBody),
        response: { 200: jobSourceResponse, ...jobErrors },
      },
    )
    .delete(
      "/:id",
      async ({ params }) => {
        const removed = await deleteJobSource(db(), params.id);
        return removed.ok ? removed.value : failure(removed.code);
      },
      {
        requireSession: true,
        params: jobIdParams,
        response: { 200: jobIdParams, ...jobErrors },
      },
    );
}
