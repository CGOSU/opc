import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { LocaleBadge } from "../components/admin/locale-badge";
import { PageHeader } from "../components/admin/page-header";
import { Pagination, type PageSize } from "../components/admin/pagination";
import { SearchInput } from "../components/admin/search-input";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/admin/states";
import { Button, buttonVariants } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { cn } from "../lib/utils";
import {
  disclosureLabels,
  jobsKey,
  jobsListQuery,
  updateJobSettings,
  verifyJob,
  type JobDisclosureType,
  type JobListQuery,
  type JobRow,
} from "./api";
import { DisclosureBadge, JobStatusBadge } from "./job-badges";

type ViewKey = NonNullable<JobListQuery["view"]>;

const shortDate = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
});

function formatVerificationMeta(job: JobRow) {
  if (job.status === "draft") return "尚未公开发布";
  if (job.status === "removed") return "已撤下（HTTP 410）";
  if (job.status === "closed") return "已手动关闭";
  if (job.status === "expired") {
    return `已过期 · ${shortDate.format(new Date(job.expiresAt))}`;
  }
  const verifiedPart =
    job.daysSinceVerified === 0
      ? "今日已核验"
      : `${job.daysSinceVerified} 天前核验`;
  const expiryPart =
    job.daysUntilExpiry <= 0
      ? "已超有效期"
      : `剩 ${job.daysUntilExpiry} 天过期`;
  return `${verifiedPart} · ${expiryPart}`;
}

export default function JobsPage() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(params.get("search") ?? "");
  const [busyId, setBusyId] = useState<string | null>(null);

  const viewParam = (params.get("view") as ViewKey | null) ?? "all_active";
  const disclosureParam =
    (params.get("disclosure") as JobDisclosureType | null) || undefined;
  const sourceIdParam = params.get("sourceId") || undefined;
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const rawSize = Number(params.get("pageSize") ?? 20);
  const pageSize: PageSize =
    rawSize === 10 || rawSize === 50 ? rawSize : 20;

  const listQuery = useQuery(
    jobsListQuery({
      view: viewParam,
      search: searchDraft.trim() || undefined,
      disclosureType: disclosureParam,
      sourceId: sourceIdParam,
      page,
      pageSize,
    }),
  );

  function patchParams(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(updates)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  }

  const verifyMutation = useMutation({
    mutationFn: (jobId: string) => verifyJob(jobId, 14),
    onMutate: (jobId) => setBusyId(jobId),
    onSuccess: () => {
      toast.success("已刷新核验时间并顺延 14 天有效期");
      void queryClient.invalidateQueries({ queryKey: jobsKey });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "复核操作失败");
    },
    onSettled: () => setBusyId(null),
  });

  const closeMutation = useMutation({
    mutationFn: (jobId: string) =>
      updateJobSettings(jobId, { status: "closed" }),
    onMutate: (jobId) => setBusyId(jobId),
    onSuccess: () => {
      toast.success("已标记为关闭并移入归档");
      void queryClient.invalidateQueries({ queryKey: jobsKey });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "标记关闭失败");
    },
    onSettled: () => setBusyId(null),
  });

  const summary = listQuery.data?.summary;

  const viewTabs: { key: ViewKey; label: string; count?: number }[] = [
    { key: "all_active", label: "全部活跃", count: summary?.open },
    { key: "needs_review", label: "待复核", count: summary?.needsReview },
    { key: "draft", label: "草稿", count: summary?.draft },
    { key: "archived", label: "已过期/关闭", count: summary?.archived },
    { key: "removed", label: "已撤下 410", count: summary?.removed },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="招聘信息与时效巡检"
        description="直写 Cloudflare D1 · 共享事实与中英双语独立修订 · 超 14 天未复核自动预警，超 30 天降级归档。"
        actions={
          <>
            <Link
              to="/job-sources"
              className={buttonVariants({ variant: "outline" })}
            >
              <Users size={15} aria-hidden="true" />
              管理博主库
            </Link>
            <Link to="/jobs/new" className={buttonVariants()}>
              <Plus size={15} aria-hidden="true" />
              粘贴 X 链接录入
            </Link>
          </>
        }
      />

      {/* 4 KPI summary cards matching Doop prototype */}
      <section
        aria-label="招聘保鲜统计"
        className="grid grid-cols-2 gap-3.5 lg:grid-cols-4"
      >
        <button
          type="button"
          onClick={() => patchParams({ view: "all_active", page: undefined })}
          className="cursor-pointer rounded-panel border border-border bg-card p-4 text-left shadow-[0_1px_2px_rgba(24,24,27,0.03)] transition-colors hover:border-input"
        >
          <div className="text-xs font-medium text-muted-foreground">
            招人中（公开）
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-success">
            {summary?.open ?? "—"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            双语完整 {summary?.bilingualOpen ?? 0} 条
          </div>
        </button>

        <button
          type="button"
          onClick={() => patchParams({ view: "needs_review", page: undefined })}
          className="cursor-pointer rounded-panel border border-border bg-card p-4 text-left shadow-[0_1px_2px_rgba(24,24,27,0.03)] transition-colors hover:border-input"
        >
          <div className="text-xs font-medium text-muted-foreground">
            待复核（&gt;14 天）
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-warning">
            {summary?.needsReview ?? "—"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            建议打开原推核验状态
          </div>
        </button>

        <Link
          to="/job-sources"
          className="rounded-panel border border-border bg-card p-4 shadow-[0_1px_2px_rgba(24,24,27,0.03)] transition-colors hover:border-input"
        >
          <div className="text-xs font-medium text-muted-foreground">
            已收录博主源
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">
            {summary?.sources ?? "—"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            含 {summary?.optOutSources ?? 0} 个拒收名单账号
          </div>
        </Link>

        <button
          type="button"
          onClick={() => patchParams({ view: "archived", page: undefined })}
          className="cursor-pointer rounded-panel border border-border bg-card p-4 text-left shadow-[0_1px_2px_rgba(24,24,27,0.03)] transition-colors hover:border-input"
        >
          <div className="text-xs font-medium text-muted-foreground">
            已过期 / 关闭归档
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">
            {summary?.archived ?? "—"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            均不进入 sitemap.xml
          </div>
        </button>
      </section>

      <section className="overflow-hidden rounded-panel border border-border bg-card shadow-[0_1px_3px_rgba(24,24,27,0.04)]">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div
            role="tablist"
            aria-label="招聘状态视图"
            className="flex flex-wrap items-center gap-1 rounded-control bg-muted p-1"
          >
            {viewTabs.map((tab) => {
              const active = viewParam === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() =>
                    patchParams({ view: tab.key, page: undefined })
                  }
                  className={cn(
                    "cursor-pointer rounded-[6px] px-2.5 py-1 text-xs font-medium transition-colors",
                    active
                      ? "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(24,24,27,0.06)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="ml-1 font-mono text-[11px] opacity-75">
                      ({tab.count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="按来源披露筛选"
              value={disclosureParam ?? ""}
              onChange={(e) =>
                patchParams({
                  disclosure: e.currentTarget.value || undefined,
                  page: undefined,
                })
              }
              className="h-8 w-36 text-xs"
            >
              <option value="">全部来源披露</option>
              {(
                Object.entries(disclosureLabels) as [
                  JobDisclosureType,
                  string,
                ][]
              ).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <SearchInput
              label="搜索招聘标题、博主或推文 ID"
              placeholder="搜索标题、@handle 或推文 ID…"
              value={searchDraft}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setSearchDraft(value);
                patchParams({ search: value.trim() || undefined, page: undefined });
              }}
              onClear={() => {
                setSearchDraft("");
                patchParams({ search: undefined, page: undefined });
              }}
              className="h-8 w-56 text-xs"
            />
          </div>
        </div>

        {/* Table body */}
        {listQuery.isPending ? (
          <div className="p-8">
            <LoadingState message="正在读取招聘列表…" />
          </div>
        ) : listQuery.isError ? (
          <div className="p-6">
            <ErrorState
              message={listQuery.error.message}
              onRetry={() => void listQuery.refetch()}
              retrying={listQuery.isFetching}
            />
          </div>
        ) : listQuery.data.items.length === 0 ? (
          <EmptyState
            icon={<BriefcaseBusiness size={18} />}
            title="当前筛选下暂无招聘条目"
            description="点击右上角「粘贴 X 链接录入」，自动规范化链接、判重并检查博主拒收名单。"
            action={
              <Link to="/jobs/new" className={buttonVariants({ size: "sm" })}>
                <Plus size={14} aria-hidden="true" />
                录入第一条推特招聘
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-background/70 text-[11px] font-semibold text-muted-foreground">
                  <th className="w-[34%] px-4 py-2.5 sm:px-5">岗位与原推来源</th>
                  <th className="w-[14%] px-3 py-2.5">来源披露</th>
                  <th className="w-[19%] px-3 py-2.5">状态与核验</th>
                  <th className="w-[10%] px-3 py-2.5">双语版本</th>
                  <th className="w-[23%] px-4 py-2.5 text-right sm:px-5">
                    巡检与快捷操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {listQuery.data.items.map((job) => {
                  const rowBusy = busyId === job.id;
                  return (
                    <tr
                      key={job.id}
                      className={cn(
                        "transition-colors hover:bg-background/60",
                        job.needsReview &&
                          "bg-warning-surface/70 hover:bg-warning-surface",
                      )}
                    >
                      <td className="px-4 py-3.5 align-middle sm:px-5">
                        <Link
                          to={`/jobs/${encodeURIComponent(job.id)}/edit`}
                          className={cn(
                            "block text-sm font-semibold text-foreground hover:underline",
                            (job.status === "expired" ||
                              job.status === "closed" ||
                              job.status === "removed") &&
                              "text-muted-foreground",
                          )}
                        >
                          {job.title}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
                          <span>@{job.source.handle}</span>
                          <span aria-hidden="true">·</span>
                          <span>ID {job.sourcePostId}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            原推{" "}
                            {shortDate.format(
                              new Date(job.sourcePostPublishedAt),
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 align-middle">
                        <DisclosureBadge type={job.disclosureType} />
                      </td>
                      <td className="px-3 py-3.5 align-middle">
                        <JobStatusBadge
                          status={job.status}
                          needsReview={job.needsReview}
                          daysSinceVerified={job.daysSinceVerified}
                        />
                        <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                          {formatVerificationMeta(job)}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 align-middle">
                        <div className="flex items-center gap-1">
                          <LocaleBadge
                            locale="zh"
                            exists={job.locales.includes("zh")}
                            variant="compact"
                          />
                          <LocaleBadge
                            locale="en"
                            exists={job.locales.includes("en")}
                            variant="compact"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right align-middle sm:px-5">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {(job.needsReview || job.status === "expired") &&
                            !job.source.optOut && (
                              <Button
                                type="button"
                                size="sm"
                                disabled={rowBusy}
                                onClick={() => verifyMutation.mutate(job.id)}
                                className="bg-teal-800 text-white hover:bg-teal-900"
                              >
                                <CheckCircle2 size={13} aria-hidden="true" />
                                确认有效 +14天
                              </Button>
                            )}
                          {job.status === "open" && job.needsReview && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={rowBusy}
                              onClick={() => closeMutation.mutate(job.id)}
                            >
                              标关闭
                            </Button>
                          )}
                          <Link
                            to={`/jobs/${encodeURIComponent(job.id)}/edit`}
                            className={buttonVariants({
                              variant: "outline",
                              size: "sm",
                            })}
                          >
                            编辑
                          </Link>
                          <a
                            href={job.sourcePostUrl}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className={buttonVariants({
                              variant: "ghost",
                              size: "sm",
                            })}
                          >
                            原推
                            <ExternalLink size={12} aria-hidden="true" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer note + pagination */}
        <div className="space-y-3 border-t border-border bg-background/60 px-4 py-3 sm:px-5">
          {listQuery.data && listQuery.data.total > 0 && (
            <Pagination
              page={listQuery.data.page}
              pageSize={pageSize}
              total={listQuery.data.total}
              showPageNumbers
              onPageChange={(nextPage) =>
                patchParams({ page: String(nextPage) })
              }
              onPageSizeChange={(nextSize) =>
                patchParams({ pageSize: String(nextSize), page: undefined })
              }
            />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={12} aria-hidden="true" />
              超 14 天未核验自动标黄进入「待复核」；超 30 天有效期可在前台自动降级归档并移出
              sitemap.xml。
            </span>
            <span className="font-mono">
              API: /api/admin/jobs · Session + CSRF Protected
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
