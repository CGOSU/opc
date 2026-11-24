import { queryOptions } from "@tanstack/react-query";
import { adminApi, writeOptions } from "../lib/admin-api";
import { readResult } from "../taxonomy/api";

const { jobs } = adminApi;
const jobSources = adminApi["job-sources"];

export const jobsKey = ["jobs"] as const;
export const jobSourcesKey = ["job-sources"] as const;

export type JobListQuery = NonNullable<
  NonNullable<Parameters<typeof jobs.get>[0]>["query"]
>;
export type JobListResult = NonNullable<
  Awaited<ReturnType<typeof jobs.get>>["data"]
>;
export type JobRow = JobListResult["items"][number];
export type JobDetail = NonNullable<
  Awaited<ReturnType<ReturnType<typeof jobs>["get"]>>["data"]
>;
export type ParseJobUrlResult = NonNullable<
  Awaited<ReturnType<(typeof jobs)["parse-url"]["post"]>>["data"]
>;
export type CreateJobInput = Parameters<typeof jobs.post>[0];
export type JobSettingsInput = Parameters<
  ReturnType<typeof jobs>["settings"]["patch"]
>[0];
type JobTranslationRoute = ReturnType<ReturnType<typeof jobs>["translations"]>;
export type JobTranslationInput = Parameters<JobTranslationRoute["post"]>[0];

export type JobSourceListQuery = NonNullable<
  NonNullable<Parameters<typeof jobSources.get>[0]>["query"]
>;
export type JobSourceListResult = NonNullable<
  Awaited<ReturnType<typeof jobSources.get>>["data"]
>;
export type JobSourceRow = JobSourceListResult["items"][number];
export type CreateJobSourceInput = Parameters<typeof jobSources.post>[0];
export type UpdateJobSourceInput = Parameters<
  ReturnType<typeof jobSources>["patch"]
>[0];

export type JobLocale = "zh" | "en";
export type JobDisclosureType = JobRow["disclosureType"];
export type JobStatus = JobRow["status"];
export type JobWorkMode = JobRow["workMode"];
export type JobEmploymentType = JobRow["employmentType"];
export type SourceRelationship = JobSourceRow["relationship"];

export const disclosureLabels: Record<JobDisclosureType, string> = {
  curated_public: "公开整理",
  author_submitted: "博主投稿",
  sponsored: "推广置顶",
};

export const statusLabels: Record<JobStatus, string> = {
  draft: "草稿",
  open: "招人中",
  expired: "已过期",
  closed: "已关闭",
  removed: "已撤下 410",
};

export const workModeLabels: Record<JobWorkMode, string> = {
  remote: "远程 Remote",
  hybrid: "混合 Hybrid",
  onsite: "现场 Onsite",
  unspecified: "原帖未说明",
};

export const employmentTypeLabels: Record<JobEmploymentType, string> = {
  full_time: "全职 Full-time",
  part_time: "兼职 Part-time",
  contract: "合同 / 外包",
  internship: "实习 Internship",
  cofounder: "联合创始人",
  unspecified: "原帖未说明",
};

export const relationshipLabels: Record<SourceRelationship, string> = {
  public: "公开收录",
  partner: "已授权合作",
  sponsored: "推广合作",
};

export function jobsListQuery(query: JobListQuery) {
  return queryOptions({
    queryKey: [...jobsKey, "list", query],
    queryFn: ({ signal }) => readResult(jobs.get({ query, fetch: { signal } })),
  });
}

export function jobDetailQuery(id: string | undefined) {
  return queryOptions({
    queryKey: [...jobsKey, "detail", id],
    enabled: !!id,
    queryFn: ({ signal }) => {
      if (!id) throw new Error("缺少招聘条目 ID。");
      return readResult(jobs({ id }).get({ fetch: { signal } }));
    },
  });
}

export function jobSourcesQuery(query: JobSourceListQuery = {}) {
  return queryOptions({
    queryKey: [...jobSourcesKey, "list", query],
    queryFn: ({ signal }) =>
      readResult(jobSources.get({ query, fetch: { signal } })),
  });
}

export function parseJobUrl(url: string) {
  return readResult(jobs["parse-url"].post({ url }, writeOptions));
}

export function createJob(values: CreateJobInput) {
  return readResult(jobs.post(values, writeOptions));
}

export function createJobTranslation(
  jobId: string,
  locale: JobLocale,
  values: JobTranslationInput,
) {
  return readResult(
    jobs({ id: jobId }).translations({ locale }).post(values, writeOptions),
  );
}

export function updateJobTranslation(
  jobId: string,
  locale: JobLocale,
  revision: number,
  values: JobTranslationInput,
) {
  return readResult(
    jobs({ id: jobId })
      .translations({ locale })
      .put({ ...values, revision }, writeOptions),
  );
}

export function reloadJobTranslation(jobId: string, locale: JobLocale) {
  return readResult(jobs({ id: jobId }).translations({ locale }).get());
}

export function updateJobSettings(jobId: string, values: JobSettingsInput) {
  return readResult(
    jobs({ id: jobId }).settings.patch(values, writeOptions),
  );
}

export function verifyJob(jobId: string, extendDays = 14) {
  return readResult(
    jobs({ id: jobId }).verify.post({ extendDays }, writeOptions),
  );
}

export function deleteJob(jobId: string) {
  return readResult(jobs({ id: jobId }).delete(undefined, writeOptions));
}

export function createJobSource(values: CreateJobSourceInput) {
  return readResult(jobSources.post(values, writeOptions));
}

export function updateJobSource(id: string, values: UpdateJobSourceInput) {
  return readResult(jobSources({ id }).patch(values, writeOptions));
}

export function deleteJobSource(id: string) {
  return readResult(jobSources({ id }).delete(undefined, writeOptions));
}
