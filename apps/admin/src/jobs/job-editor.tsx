import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Link2,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { ConfirmDialog } from "../components/admin/confirm-dialog";
import { ErrorState, LoadingState } from "../components/admin/states";
import { Button, buttonVariants } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { cn } from "../lib/utils";
import { AdminRequestError } from "../taxonomy/api";
import {
  createJob,
  createJobTranslation,
  deleteJob,
  disclosureLabels,
  employmentTypeLabels,
  jobDetailQuery,
  jobsKey,
  jobSourcesKey,
  parseJobUrl,
  reloadJobTranslation,
  statusLabels,
  updateJobSettings,
  updateJobTranslation,
  verifyJob,
  workModeLabels,
  type JobDetail,
  type JobDisclosureType,
  type JobEmploymentType,
  type JobLocale,
  type JobStatus,
  type JobWorkMode,
  type ParseJobUrlResult,
} from "./api";
import { JobStatusBadge } from "./job-badges";

function toDateInputValue(iso: string) {
  return iso.slice(0, 10);
}

function dateInputToIso(dateStr: string) {
  return new Date(`${dateStr}T12:00:00.000Z`).toISOString();
}

function defaultTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function defaultExpireDate() {
  return new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
}

function slugifyHint(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type TranslationDraft = {
  title: string;
  slug: string;
  summary: string;
  content: string;
  sourceExcerpt: string;
  seoTitle: string;
  seoDescription: string;
  revision?: number;
};

const emptyTranslationDraft: TranslationDraft = {
  title: "",
  slug: "",
  summary: "",
  content: "",
  sourceExcerpt: "",
  seoTitle: "",
  seoDescription: "",
};

type SettingsDraft = {
  disclosureType: JobDisclosureType;
  workMode: JobWorkMode;
  employmentType: JobEmploymentType;
  locationText: string;
  compensationText: string;
  applyUrl: string;
  sourcePostPublishedDate: string;
  expiresDate: string;
  status: JobStatus;
  isFeatured: boolean;
};

function defaultSettingsDraft(): SettingsDraft {
  return {
    disclosureType: "curated_public",
    workMode: "remote",
    employmentType: "full_time",
    locationText: "",
    compensationText: "",
    applyUrl: "",
    sourcePostPublishedDate: defaultTodayDate(),
    expiresDate: defaultExpireDate(),
    status: "open",
    isFeatured: false,
  };
}

function translationFromJob(
  job: JobDetail,
  locale: JobLocale,
): TranslationDraft {
  const found = job.translations.find((item) => item.locale === locale);
  if (!found) return { ...emptyTranslationDraft };
  return {
    title: found.title,
    slug: found.slug,
    summary: found.summary,
    content: found.content,
    sourceExcerpt: found.sourceExcerpt,
    seoTitle: found.seoTitle ?? "",
    seoDescription: found.seoDescription ?? "",
    revision: found.revision,
  };
}

function settingsFromJob(job: JobDetail): SettingsDraft {
  return {
    disclosureType: job.disclosureType,
    workMode: job.workMode,
    employmentType: job.employmentType,
    locationText: job.locationText,
    compensationText: job.compensationText,
    applyUrl: job.applyUrl ?? "",
    sourcePostPublishedDate: toDateInputValue(job.sourcePostPublishedAt),
    expiresDate: toDateInputValue(job.expiresAt),
    status: job.status,
    isFeatured: job.isFeatured,
  };
}

export default function JobEditor() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const detailQuery = useQuery(jobDetailQuery(id));

  // Create-mode URL parsing state
  const [rawUrl, setRawUrl] = useState("");
  const [parsed, setParsed] = useState<ParseJobUrlResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [newSourceDisplayName, setNewSourceDisplayName] = useState("");

  // Locale & content draft
  const [locale, setLocale] = useState<JobLocale>("zh");
  const [translation, setTranslation] = useState<TranslationDraft>(
    emptyTranslationDraft,
  );
  const [settings, setSettings] = useState<SettingsDraft>(defaultSettingsDraft);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [revisionConflict, setRevisionConflict] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isEdit || !detailQuery.data || hydratedId === detailQuery.data.id) {
      return;
    }
    const job = detailQuery.data;
    const initialLocale = job.primaryLocale;
    setLocale(initialLocale);
    setTranslation(translationFromJob(job, initialLocale));
    setSettings(settingsFromJob(job));
    setHydratedId(job.id);
    setTranslationError(null);
    setRevisionConflict(false);
    setSettingsError(null);
  }, [isEdit, detailQuery.data, hydratedId]);

  const parseMutation = useMutation({
    mutationFn: (url: string) => parseJobUrl(url),
    onSuccess: (result) => {
      setParsed(result);
      setParseError(null);
      setRawUrl(result.canonicalUrl);
      if (result.source) {
        setNewSourceDisplayName(result.source.displayName);
      } else {
        setNewSourceDisplayName(`@${result.handle}`);
      }
      if (!translation.slug) {
        setTranslation((prev) => ({
          ...prev,
          slug: `${result.handle}-${result.statusId.slice(-6)}`,
        }));
      }
    },
    onError: (err) => {
      setParsed(null);
      setParseError(err instanceof Error ? err.message : "链接校验失败");
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createJob({
        locale,
        sourcePostUrl: parsed?.canonicalUrl ?? rawUrl.trim(),
        sourceId: parsed?.source?.id,
        sourceDisplayName: parsed?.source
          ? undefined
          : newSourceDisplayName.trim() || undefined,
        title: translation.title.trim(),
        slug: translation.slug.trim().toLowerCase(),
        summary: translation.summary.trim(),
        content: translation.content.trim(),
        sourceExcerpt: translation.sourceExcerpt.trim(),
        seoTitle: translation.seoTitle.trim() || null,
        seoDescription: translation.seoDescription.trim() || null,
        disclosureType: settings.disclosureType,
        workMode: settings.workMode,
        employmentType: settings.employmentType,
        locationText: settings.locationText.trim(),
        compensationText: settings.compensationText.trim(),
        applyUrl: settings.applyUrl.trim() || null,
        sourcePostPublishedAt: dateInputToIso(settings.sourcePostPublishedDate),
        expiresAt: dateInputToIso(settings.expiresDate),
        status: settings.status,
        isFeatured: settings.isFeatured,
      }),
    onSuccess: (created) => {
      toast.success("已录入推特招聘条目");
      void queryClient.invalidateQueries({ queryKey: jobsKey });
      void queryClient.invalidateQueries({ queryKey: jobSourcesKey });
      void navigate(`/jobs/${encodeURIComponent(created.id)}/edit`, {
        replace: true,
      });
    },
    onError: (err) => {
      setTranslationError(err instanceof Error ? err.message : "保存失败");
    },
  });

  const saveTranslationMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("缺少招聘 ID");
      const payload = {
        title: translation.title.trim(),
        slug: translation.slug.trim().toLowerCase(),
        summary: translation.summary.trim(),
        content: translation.content.trim(),
        sourceExcerpt: translation.sourceExcerpt.trim(),
        seoTitle: translation.seoTitle.trim() || null,
        seoDescription: translation.seoDescription.trim() || null,
      };
      if (translation.revision === undefined) {
        return createJobTranslation(id, locale, payload);
      }
      return updateJobTranslation(id, locale, translation.revision, payload);
    },
    onSuccess: (saved) => {
      setTranslation((prev) => ({ ...prev, revision: saved.revision }));
      setTranslationError(null);
      setRevisionConflict(false);
      toast.success(`已保存${locale === "zh" ? "中文" : "英文"}版本`);
      void queryClient.invalidateQueries({ queryKey: jobsKey });
    },
    onError: (err) => {
      if (err instanceof AdminRequestError && err.code === "REVISION_CONFLICT") {
        setRevisionConflict(true);
      }
      setTranslationError(err instanceof Error ? err.message : "保存语言版本失败");
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("缺少招聘 ID");
      return updateJobSettings(id, {
        disclosureType: settings.disclosureType,
        workMode: settings.workMode,
        employmentType: settings.employmentType,
        locationText: settings.locationText.trim(),
        compensationText: settings.compensationText.trim(),
        applyUrl: settings.applyUrl.trim() || null,
        sourcePostPublishedAt: dateInputToIso(settings.sourcePostPublishedDate),
        expiresAt: dateInputToIso(settings.expiresDate),
        status: settings.status,
        isFeatured: settings.isFeatured,
      });
    },
    onSuccess: () => {
      setSettingsError(null);
      toast.success("已更新共享事实与披露设置");
      void queryClient.invalidateQueries({ queryKey: jobsKey });
      void queryClient.invalidateQueries({ queryKey: jobSourcesKey });
    },
    onError: (err) => {
      setSettingsError(err instanceof Error ? err.message : "保存设置失败");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error("缺少招聘 ID");
      return verifyJob(id, 14);
    },
    onSuccess: (res) => {
      setSettings((prev) => ({
        ...prev,
        status: res.status,
        expiresDate: toDateInputValue(res.expiresAt),
      }));
      toast.success("已确认有效并顺延 14 天");
      void queryClient.invalidateQueries({ queryKey: jobsKey });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "复核操作失败");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error("缺少招聘 ID");
      return deleteJob(id);
    },
    onSuccess: () => {
      toast.success("已删除该招聘条目");
      void queryClient.invalidateQueries({ queryKey: jobsKey });
      void queryClient.invalidateQueries({ queryKey: jobSourcesKey });
      void navigate("/jobs", { replace: true });
    },
    onError: (err) => {
      setDeleteError(err instanceof Error ? err.message : "删除失败");
    },
  });

  function switchLocale(nextLocale: JobLocale) {
    setLocale(nextLocale);
    setTranslationError(null);
    setRevisionConflict(false);
    if (isEdit && detailQuery.data) {
      setTranslation(translationFromJob(detailQuery.data, nextLocale));
    }
  }

  async function handleReloadServerTranslation() {
    if (!id) return;
    try {
      const fresh = await reloadJobTranslation(id, locale);
      setTranslation(translationFromJob(fresh, locale));
      setRevisionConflict(false);
      setTranslationError(null);
      void queryClient.invalidateQueries({ queryKey: [...jobsKey, "detail", id] });
      toast.success("已载入服务器最新版本");
    } catch (err) {
      setTranslationError(err instanceof Error ? err.message : "重新载入失败");
    }
  }

  function handlePrimarySubmit(event: FormEvent) {
    event.preventDefault();
    setTranslationError(null);
    if (isEdit) {
      saveTranslationMutation.mutate();
    } else {
      if (parsed?.blockedByOptOut) {
        setTranslationError(
          "该博主已在拒收名单（opt_out）中，无法创建招聘条目。",
        );
        return;
      }
      createMutation.mutate();
    }
  }

  if (isEdit && detailQuery.isPending) {
    return <LoadingState message="正在载入招聘详情…" />;
  }

  if (isEdit && detailQuery.isError) {
    return (
      <div className="space-y-4">
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          返回招聘列表
        </Link>
        <ErrorState
          message={detailQuery.error.message}
          onRetry={() => void detailQuery.refetch()}
          retrying={detailQuery.isFetching}
        />
      </div>
    );
  }

  const job = detailQuery.data;
  const hasZh = job?.locales.includes("zh") ?? false;
  const hasEn = job?.locales.includes("en") ?? false;
  const excerptLength = translation.sourceExcerpt.length;
  const isBlockedCreate = !isEdit && !!parsed?.blockedByOptOut;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            返回招聘列表 (/jobs)
          </Link>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {isEdit ? "编辑推特招聘条目" : "粘贴 X 链接录入推特招聘"}
          </h1>
        </div>

        {isEdit && job && (
          <div className="flex flex-wrap items-center gap-2">
            {!job.source.optOut && (
              <Button
                type="button"
                variant="outline"
                disabled={verifyMutation.isPending}
                onClick={() => verifyMutation.mutate()}
              >
                <CheckCircle2 size={14} aria-hidden="true" />
                {verifyMutation.isPending ? "复核中…" : "确认有效 +14天"}
              </Button>
            )}
            <a
              href={job.sourcePostUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={buttonVariants({ variant: "outline" })}
            >
              打开 X 原推
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        )}
      </div>

      {/* Step 1: X URL parse & 4-check guard bar */}
      <section className="rounded-panel border border-border bg-card p-4 shadow-[0_1px_2px_rgba(24,24,27,0.03)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-foreground">
            {isEdit
              ? "原推文来源与博主归属（已锁定）"
              : "第一步：粘贴 X 推文链接（自动规范化、去重并校验博主拒收名单）"}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            POST /api/admin/jobs/parse-url
          </span>
        </div>

        {isEdit && job ? (
          <div className="mt-3 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="min-w-0 flex-1 rounded-control border border-border bg-background px-3 py-2 font-mono text-xs text-foreground">
                {job.sourcePostUrl}
              </div>
              <Link
                to="/job-sources"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                博主：{job.source.displayName} (@{job.source.handle})
              </Link>
            </div>
            {job.source.optOut && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-control border border-destructive-border bg-destructive-surface px-3 py-2 text-xs text-destructive"
              >
                <ShieldAlert
                  size={15}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0"
                />
                <span>
                  该博主已被列入拒收名单（opt_out），系统禁止将此条目重新设为「招人中」。
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                aria-label="X 原推文链接"
                placeholder="https://x.com/marc_louvion/status/1860248912041"
                value={rawUrl}
                onChange={(e) => setRawUrl(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && rawUrl.trim()) {
                    e.preventDefault();
                    parseMutation.mutate(rawUrl);
                  }
                }}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                disabled={!rawUrl.trim() || parseMutation.isPending}
                onClick={() => parseMutation.mutate(rawUrl)}
              >
                <Link2 size={14} aria-hidden="true" />
                {parseMutation.isPending ? "校验中…" : "校验链接"}
              </Button>
            </div>

            {parseError && <ErrorState message={parseError} />}

            {parsed && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-control bg-success-surface px-2.5 py-1 font-semibold text-success">
                    <CheckCircle2 size={13} aria-hidden="true" />
                    URL 已规范化去参
                  </span>

                  {parsed.duplicateJob ? (
                    <Link
                      to={`/jobs/${encodeURIComponent(parsed.duplicateJob.id)}/edit`}
                      className="inline-flex items-center gap-1.5 rounded-control bg-destructive-surface px-2.5 py-1 font-semibold text-destructive underline-offset-2 hover:underline"
                    >
                      <AlertTriangle size={13} aria-hidden="true" />
                      已存在重复收录：{parsed.duplicateJob.title}（点击去编辑）
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-control bg-success-surface px-2.5 py-1 font-semibold text-success">
                      <CheckCircle2 size={13} aria-hidden="true" />
                      站内无重复收录
                    </span>
                  )}

                  {parsed.source ? (
                    <span className="inline-flex items-center gap-1.5 rounded-control bg-success-surface px-2.5 py-1 font-semibold text-success">
                      <CheckCircle2 size={13} aria-hidden="true" />
                      匹配博主库：{parsed.source.displayName} (@
                      {parsed.source.handle})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-control border border-border bg-muted px-2.5 py-1 font-medium text-foreground">
                      新博主 @{parsed.handle}（保存时将自动建档）
                    </span>
                  )}

                  {parsed.blockedByOptOut ? (
                    <span className="inline-flex items-center gap-1.5 rounded-control bg-destructive-surface px-2.5 py-1 font-semibold text-destructive">
                      <ShieldAlert size={13} aria-hidden="true" />
                      命中拒收名单 (opt_out = true)，已拦截录入
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-control bg-success-surface px-2.5 py-1 font-semibold text-success">
                      <CheckCircle2 size={13} aria-hidden="true" />
                      拒收名单检查通过 (opt_out = false)
                    </span>
                  )}
                </div>

                {!parsed.source && !parsed.blockedByOptOut && (
                  <div className="max-w-sm space-y-1">
                    <label
                      htmlFor="new-source-name"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      新博主展示名称（自动入库用）
                    </label>
                    <Input
                      id="new-source-name"
                      value={newSourceDisplayName}
                      onChange={(e) =>
                        setNewSourceDisplayName(e.currentTarget.value)
                      }
                      placeholder={`例如 @${parsed.handle}`}
                      className="h-8 text-xs"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Main 2-column form */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_356px] xl:items-start">
        {/* Left: Language translation form */}
        <form
          onSubmit={handlePrimarySubmit}
          className="space-y-4 rounded-panel border border-border bg-card p-5 shadow-[0_1px_2px_rgba(24,24,27,0.03)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3.5">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                当前语言内容{isEdit ? "（独立保存）" : "（首个语言版本）"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                沿用文章双语范式：中英文独立编辑与修订，不互相覆盖。
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-control bg-muted p-1">
              {(["zh", "en"] as const).map((loc) => {
                const exists = loc === "zh" ? hasZh : hasEn;
                const active = locale === loc;
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => switchLocale(loc)}
                    className={cn(
                      "cursor-pointer rounded-[6px] px-2.5 py-1 text-xs font-semibold transition-colors",
                      active
                        ? "bg-card text-foreground shadow-[0_1px_2px_rgba(24,24,27,0.06)]"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {loc === "zh" ? "中文 zh" : "English en"}
                    {isEdit && (
                      <span className="ml-1 font-normal opacity-75">
                        ({exists ? "已保存" : "未创建"})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {revisionConflict && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-warning-border bg-warning-surface px-3.5 py-2.5 text-xs text-warning"
            >
              <span>
                服务器上的该语言版本已更新，当前草稿已保留未覆盖。你可以载入最新版本后再合并。
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleReloadServerTranslation()}
              >
                <RefreshCw size={12} aria-hidden="true" />
                重新载入最新版本
              </Button>
            </div>
          )}

          {translationError && !revisionConflict && (
            <ErrorState message={translationError} />
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="job-title" className="text-xs font-semibold">
                整理后岗位标题 *
              </label>
              <span className="text-[11px] text-muted-foreground">
                清晰概括角色，不照搬推文口语
              </span>
            </div>
            <Input
              id="job-title"
              required
              maxLength={200}
              value={translation.title}
              onChange={(e) => {
                const title = e.currentTarget.value;
                setTranslation((prev) => ({
                  ...prev,
                  title,
                  slug:
                    !prev.slug && /^[a-zA-Z0-9\s-]+$/.test(title)
                      ? slugifyHint(title)
                      : prev.slug,
                }));
              }}
              placeholder="例如：全栈产品工程师（AI 视频生成与独立 SaaS 工具）"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="job-slug" className="text-xs font-semibold">
                URL Slug *
              </label>
              <span className="font-mono text-[11px] text-muted-foreground">
                /{locale}/jobs/{translation.slug || "slug"}/
              </span>
            </div>
            <Input
              id="job-slug"
              required
              maxLength={120}
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              value={translation.slug}
              onChange={(e) =>
                setTranslation((prev) => ({
                  ...prev,
                  slug: e.currentTarget.value.toLowerCase(),
                }))
              }
              placeholder="ai-video-product-engineer"
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="job-summary" className="text-xs font-semibold">
                列表页摘要（1–2 句）
              </label>
              <span className="font-mono text-[11px] text-muted-foreground">
                {translation.summary.length} / 500
              </span>
            </div>
            <Textarea
              id="job-summary"
              rows={2}
              maxLength={500}
              value={translation.summary}
              onChange={(e) =>
                setTranslation((prev) => ({
                  ...prev,
                  summary: e.currentTarget.value,
                }))
              }
              placeholder="简明提炼核心方向、协作方式与团队特点…"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="job-content" className="text-xs font-semibold">
                结构化岗位整理（Markdown）*
              </label>
              <span className="text-[11px] text-muted-foreground">
                避免空壳桥页，只写原帖可核实的要点
              </span>
            </div>
            <Textarea
              id="job-content"
              required
              rows={8}
              value={translation.content}
              onChange={(e) =>
                setTranslation((prev) => ({
                  ...prev,
                  content: e.currentTarget.value,
                }))
              }
              placeholder={`### 岗位要点\n- 核心职责与技术栈\n\n### 投递方式\n- 前往原推文按博主说明提交（本站不代收简历）`}
              className="font-mono text-xs leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="job-excerpt" className="text-xs font-semibold">
                原推关键句短摘录（版权合规 ≤200 字符）
              </label>
              <span
                className={cn(
                  "font-mono text-[11px]",
                  excerptLength > 200
                    ? "font-semibold text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {excerptLength} / 200
              </span>
            </div>
            <Textarea
              id="job-excerpt"
              rows={2}
              maxLength={200}
              value={translation.sourceExcerpt}
              onChange={(e) =>
                setTranslation((prev) => ({
                  ...prev,
                  sourceExcerpt: e.currentTarget.value,
                }))
              }
              placeholder="仅摘录 1–2 句核心引述用于归属说明，切勿全文搬运推文…"
              className="bg-background/60 italic"
            />
          </div>

          <details className="rounded-control border border-border bg-background/50 p-3">
            <summary className="cursor-pointer text-xs font-semibold text-foreground">
              SEO 覆盖（可选）
            </summary>
            <div className="mt-3 space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="job-seo-title"
                  className="text-xs text-muted-foreground"
                >
                  SEO 标题
                </label>
                <Input
                  id="job-seo-title"
                  maxLength={200}
                  value={translation.seoTitle}
                  onChange={(e) =>
                    setTranslation((prev) => ({
                      ...prev,
                      seoTitle: e.currentTarget.value,
                    }))
                  }
                  placeholder="留空默认使用整理后岗位标题"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="job-seo-desc"
                  className="text-xs text-muted-foreground"
                >
                  SEO 描述
                </label>
                <Textarea
                  id="job-seo-desc"
                  rows={2}
                  maxLength={500}
                  value={translation.seoDescription}
                  onChange={(e) =>
                    setTranslation((prev) => ({
                      ...prev,
                      seoDescription: e.currentTarget.value,
                    }))
                  }
                  placeholder="留空默认使用列表页摘要"
                />
              </div>
            </div>
          </details>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <span className="font-mono text-[11px] text-muted-foreground">
              {isEdit
                ? translation.revision !== undefined
                  ? `PUT /translations/${locale} · revision: ${translation.revision}（乐观锁保护）`
                  : `POST /translations/${locale} · 新建语言版本`
                : "POST /api/admin/jobs · 原子写入共享事实与首个语言版本"}
            </span>
            <Button
              type="submit"
              disabled={
                isBlockedCreate ||
                createMutation.isPending ||
                saveTranslationMutation.isPending
              }
            >
              {isEdit
                ? saveTranslationMutation.isPending
                  ? "保存中…"
                  : translation.revision !== undefined
                    ? `保存当前语言 (${locale})`
                    : `添加${locale === "zh" ? "中文" : "英文"}版本`
                : createMutation.isPending
                  ? "录入中…"
                  : "录入并保存条目"}
            </Button>
          </div>
        </form>

        {/* Right: Shared factual & disclosure settings */}
        <aside className="space-y-4">
          <div className="space-y-4 rounded-panel border border-border bg-card p-5 shadow-[0_1px_2px_rgba(24,24,27,0.03)]">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold text-foreground">
                共享事实与披露设置
              </h2>
              <JobStatusBadge status={settings.status} />
            </div>

            {settingsError && <ErrorState message={settingsError} />}

            <div className="space-y-1.5">
              <span className="block text-xs font-semibold">
                来源性质披露（前台必显）
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    "curated_public",
                    "author_submitted",
                    "sponsored",
                  ] as JobDisclosureType[]
                ).map((type) => {
                  const active = settings.disclosureType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          disclosureType: type,
                        }))
                      }
                      className={cn(
                        "cursor-pointer rounded-control border px-2 py-2 text-center text-[11px] font-semibold transition-colors",
                        active
                          ? "border-teal-700 bg-teal-50 text-teal-800"
                          : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {disclosureLabels[type]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label htmlFor="job-work-mode" className="text-xs font-semibold">
                  工作方式
                </label>
                <Select
                  id="job-work-mode"
                  value={settings.workMode}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      workMode: e.currentTarget.value as JobWorkMode,
                    }))
                  }
                >
                  {(
                    Object.entries(workModeLabels) as [JobWorkMode, string][]
                  ).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <label htmlFor="job-emp-type" className="text-xs font-semibold">
                  雇佣类型
                </label>
                <Select
                  id="job-emp-type"
                  value={settings.employmentType}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      employmentType: e.currentTarget
                        .value as JobEmploymentType,
                    }))
                  }
                >
                  {(
                    Object.entries(employmentTypeLabels) as [
                      JobEmploymentType,
                      string,
                    ][]
                  ).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="job-location" className="text-xs font-semibold">
                工作地点 / 时区
              </label>
              <Input
                id="job-location"
                maxLength={160}
                value={settings.locationText}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    locationText: e.currentTarget.value,
                  }))
                }
                placeholder="例如：全球 / UTC+8 可异步"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="job-comp" className="text-xs font-semibold">
                  薪资披露
                </label>
                <span className="text-[11px] text-muted-foreground">
                  留空显示「原帖未披露」
                </span>
              </div>
              <Input
                id="job-comp"
                maxLength={160}
                value={settings.compensationText}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    compensationText: e.currentTarget.value,
                  }))
                }
                placeholder="例如：$120k–$150k / 年（切勿推测）"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="job-apply-url" className="text-xs font-semibold">
                原帖附带投递链接（可选）
              </label>
              <Input
                id="job-apply-url"
                maxLength={2048}
                value={settings.applyUrl}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    applyUrl: e.currentTarget.value,
                  }))
                }
                placeholder="https://... 或 mailto:jobs@..."
                className="font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label htmlFor="job-pub-date" className="text-xs font-semibold">
                  原推发布日期
                </label>
                <Input
                  id="job-pub-date"
                  type="date"
                  value={settings.sourcePostPublishedDate}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      sourcePostPublishedDate: e.currentTarget.value,
                    }))
                  }
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="job-exp-date" className="text-xs font-semibold">
                  自动过期日期
                </label>
                <Input
                  id="job-exp-date"
                  type="date"
                  value={settings.expiresDate}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      expiresDate: e.currentTarget.value,
                    }))
                  }
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="job-status" className="text-xs font-semibold">
                发布状态
              </label>
              <Select
                id="job-status"
                value={settings.status}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    status: e.currentTarget.value as JobStatus,
                  }))
                }
              >
                {(Object.entries(statusLabels) as [JobStatus, string][]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </Select>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={settings.isFeatured}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    isFeatured: e.currentTarget.checked,
                  }))
                }
                className="size-4 rounded border-border accent-primary"
              />
              <span>设为列表置顶 / 精选展示</span>
            </label>

            {isEdit && (
              <div className="flex items-center justify-between border-t border-border pt-3.5">
                <span className="font-mono text-[11px] text-muted-foreground">
                  PATCH /settings
                </span>
                <Button
                  type="button"
                  disabled={saveSettingsMutation.isPending}
                  onClick={() => saveSettingsMutation.mutate()}
                  className="bg-teal-800 text-white hover:bg-teal-900"
                >
                  {saveSettingsMutation.isPending ? "保存中…" : "保存共享设置"}
                </Button>
              </div>
            )}
          </div>

          {isEdit && job && (
            <div className="rounded-panel border border-destructive-border bg-destructive-surface/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-destructive">
                    永久删除招聘条目
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    若为博主申请撤下，优先将状态改为「已撤下 410」以保留撤稿记录。
                  </p>
                </div>
                <ConfirmDialog
                  open={deleteOpen}
                  onOpenChange={(open) => {
                    setDeleteOpen(open);
                    if (!open) setDeleteError(undefined);
                  }}
                  title="确认删除这条招聘条目？"
                  description="此操作将永久删除该招聘及其所有中英文译文，无法恢复。"
                  confirmLabel="确认永久删除"
                  pending={deleteMutation.isPending}
                  error={deleteError}
                  onConfirm={() => deleteMutation.mutate()}
                  trigger={
                    <Button type="button" variant="destructive" size="sm">
                      <Trash2 size={13} aria-hidden="true" />
                      删除
                    </Button>
                  }
                />
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
