import { queryOptions, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Link } from "react-router";
import { PageHeader } from "../components/admin/page-header";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/admin/states";
import { buttonVariants } from "../components/ui/button";
import { adminApi } from "../lib/admin-api";
import { readResult } from "../taxonomy/api";

const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: ({ signal }) =>
    readResult(adminApi.dashboard.get({ fetch: { signal } })),
});

type Dashboard = NonNullable<
  Awaited<ReturnType<typeof adminApi.dashboard.get>>["data"]
>;
const metrics = [
  ["posts", "文章总数"],
  ["topics", "专题总数"],
  ["categories", "分类总数"],
  ["tags", "标签总数"],
] as const satisfies readonly (readonly [keyof Dashboard["counts"], string])[];

const numberFormat = new Intl.NumberFormat("zh-CN");
const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function RecentActivity<T extends Dashboard["recentTopics"][number]>({
  title,
  headingId,
  emptyTitle,
  entries,
  href,
  detail,
}: {
  title: string;
  headingId: string;
  emptyTitle: string;
  entries: T[];
  href: (entry: T) => string;
  detail?: (entry: T) => string;
}) {
  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <h2 id={headingId} className="mb-3 text-base font-semibold">
        {title}
      </h2>
      <div className="rounded-control border border-border bg-card">
        {entries.length ? (
          <ul className="divide-y divide-border">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  to={href(entry)}
                  className="flex min-h-11 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 outline-none hover:bg-accent hover:text-primary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="min-w-0 flex-1 basis-36 font-medium wrap-anywhere">
                    {entry.title}
                    {detail && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {detail(entry)}
                      </span>
                    )}
                  </span>
                  <time
                    dateTime={entry.timestamp}
                    className="text-xs tabular-nums text-muted-foreground"
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
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const dashboard = useQuery(dashboardQuery);
  return (
    <div className="space-y-6">
      <PageHeader
        title="工作台"
        description="查看内容总量和最近动态。"
        actions={
          <>
            <Link to="/posts/new" className={buttonVariants()}>
              <Plus size={16} aria-hidden="true" />
              新建文章
            </Link>
            <Link
              to="/topics/new"
              className={buttonVariants({ variant: "outline" })}
            >
              新建专题
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
          <dl
            aria-label="内容总量"
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            {metrics.map(([key, label]) => (
              <div
                key={key}
                className="space-y-1 rounded-control border border-border bg-card px-4 py-3"
              >
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-2xl font-semibold tabular-nums">
                  {numberFormat.format(dashboard.data.counts[key])}
                </dd>
              </div>
            ))}
          </dl>
          <div className="grid gap-6 lg:grid-cols-2">
            <RecentActivity
              headingId="recent-posts"
              title="最近更新的文章"
              emptyTitle="暂无文章"
              entries={dashboard.data.recentPosts}
              href={({ id }) => `/posts/${encodeURIComponent(id)}/edit`}
              detail={({ locale }) => (locale === "zh" ? "中文" : "English")}
            />
            <RecentActivity
              headingId="recent-topics"
              title="最近创建的专题"
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
