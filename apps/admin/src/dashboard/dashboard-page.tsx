import { queryOptions, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  ExternalLink,
  FileText,
  FolderOpen,
  Layers,
  Plus,
  Tags,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";
import { LocaleBadge } from "../components/admin/locale-badge";
import { PageHeader } from "../components/admin/page-header";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/admin/states";
import { buttonVariants } from "../components/ui/button";
import { adminApi, publicSiteOrigin } from "../lib/admin-api";
import { cn } from "../lib/utils";
import { readResult } from "../taxonomy/api";

const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: ({ signal }) =>
    readResult(adminApi.dashboard.get({ fetch: { signal } })),
});

type Dashboard = NonNullable<
  Awaited<ReturnType<typeof adminApi.dashboard.get>>["data"]
>;

const metrics: readonly {
  key: keyof Dashboard["counts"];
  label: string;
  to: string;
  icon: LucideIcon;
  hint: string;
}[] = [
  {
    key: "posts",
    label: "文章总数",
    to: "/posts",
    icon: FileText,
    hint: "管理双语文章",
  },
  {
    key: "topics",
    label: "专题总数",
    to: "/topics",
    icon: Layers,
    hint: "编辑专题合集",
  },
  {
    key: "categories",
    label: "分类总数",
    to: "/categories",
    icon: FolderOpen,
    hint: "维护内容分类",
  },
  {
    key: "tags",
    label: "标签总数",
    to: "/tags",
    icon: Tags,
    hint: "梳理文章标签",
  },
];

const numberFormat = new Intl.NumberFormat("zh-CN");
const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function RecentActivity<T extends Dashboard["recentTopics"][number]>({
  title,
  headingId,
  icon: Icon,
  allHref,
  allLabel,
  emptyTitle,
  entries,
  href,
  renderMeta,
}: {
  title: string;
  headingId: string;
  icon: LucideIcon;
  allHref: string;
  allLabel: string;
  emptyTitle: string;
  entries: T[];
  href: (entry: T) => string;
  renderMeta?: (entry: T) => React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 overflow-hidden rounded-panel border border-border bg-card shadow-[0_1px_3px_rgba(24,24,27,0.04)]"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border bg-background/60 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <Icon
            size={16}
            aria-hidden="true"
            className="shrink-0 text-muted-foreground"
          />
          <h2
            id={headingId}
            className="truncate text-sm font-semibold text-foreground"
          >
            {title}
          </h2>
        </div>
        <Link
          to={allHref}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <span>{allLabel}</span>
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </header>
      {entries.length ? (
        <ul className="divide-y divide-border">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link
                to={href(entry)}
                className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-3 transition-colors duration-100 outline-none hover:bg-background/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-5"
              >
                <span className="flex min-w-0 flex-1 basis-44 items-center gap-2">
                  <span className="truncate font-medium text-foreground">
                    {entry.title}
                  </span>
                  {renderMeta?.(entry)}
                </span>
                <time
                  dateTime={entry.timestamp}
                  className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground"
                >
                  {dateFormat.format(new Date(entry.timestamp))}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={emptyTitle} />
      )}
    </section>
  );
}

export default function DashboardPage() {
  const dashboard = useQuery(dashboardQuery);
  return (
    <div className="space-y-6">
      <PageHeader
        title="工作台"
        description="查看内容总量、双语发布动态与快捷管理入口。"
        actions={
          <>
            <a
              href={publicSiteOrigin}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              <ExternalLink size={15} aria-hidden="true" />
              访问前台
            </a>
            <Link
              to="/topics/new"
              className={buttonVariants({ variant: "outline" })}
            >
              <Plus size={15} aria-hidden="true" />
              新建专题
            </Link>
            <Link to="/posts/new" className={buttonVariants()}>
              <Plus size={15} aria-hidden="true" />
              新建文章
            </Link>
          </>
        }
      />
      {dashboard.isPending ? (
        <LoadingState message="正在读取站点内容…" />
      ) : dashboard.isError ? (
        <ErrorState
          message="无法读取工作台数据。"
          onRetry={() => void dashboard.refetch()}
          retrying={dashboard.isFetching}
        />
      ) : (
        <>
          <section aria-label="内容总量">
            <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
              {metrics.map(({ key, label, to, icon: Icon, hint }) => (
                <Link
                  key={key}
                  to={to}
                  className="group rounded-panel border border-border bg-card p-4 shadow-[0_1px_2px_rgba(24,24,27,0.03)] transition-[border-color,box-shadow,transform] duration-150 outline-none hover:-translate-y-0.5 hover:border-input hover:shadow-[0_4px_12px_rgba(24,24,27,0.06)] focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {label}
                    </span>
                    <span
                      aria-hidden="true"
                      className="grid size-7 place-items-center rounded-control border border-border bg-background text-muted-foreground transition-colors group-hover:border-input group-hover:text-foreground"
                    >
                      <Icon size={14} />
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                      {numberFormat.format(dashboard.data.counts[key])}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                      <span className="hidden sm:inline">{hint}</span>
                      <ArrowUpRight size={13} aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
          <div className="grid gap-5 lg:grid-cols-2">
            <RecentActivity
              headingId="recent-posts"
              title="最近更新的文章"
              icon={FileText}
              allHref="/posts"
              allLabel="全部文章"
              emptyTitle="暂无文章"
              entries={dashboard.data.recentPosts}
              href={({ id }) => `/posts/${encodeURIComponent(id)}/edit`}
              renderMeta={({ locale }) => (
                <LocaleBadge
                  locale={locale === "zh" ? "zh" : "en"}
                  exists
                  variant="compact"
                  className={cn("shrink-0")}
                />
              )}
            />
            <RecentActivity
              headingId="recent-topics"
              title="最近创建的专题"
              icon={Layers}
              allHref="/topics"
              allLabel="全部专题"
              emptyTitle="暂无专题"
              entries={dashboard.data.recentTopics}
              href={({ id }) => `/topics/${encodeURIComponent(id)}`}
            />
          </div>
        </>
      )}
    </div>
  );
}
