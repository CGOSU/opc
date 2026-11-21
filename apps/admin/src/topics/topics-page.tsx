import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ExternalLink, Layers, Plus, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { ConfirmDialog } from "../components/admin/confirm-dialog";
import { DataTable } from "../components/admin/data-table";
import { LocaleBadge } from "../components/admin/locale-badge";
import { PageHeader } from "../components/admin/page-header";
import { Pagination } from "../components/admin/pagination";
import { SearchInput } from "../components/admin/search-input";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/admin/states";
import { Button, buttonVariants } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { publicSiteOrigin } from "../lib/admin-api";
import { cn } from "../lib/utils";
import { postsKey } from "../posts/api";
import { deleteTopic, topicList, topicsKey, type TopicRow } from "./api";

function TopicActions({ topic }: { topic: TopicRow }) {
  const [open, setOpen] = useState(false);
  const cache = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deleteTopic(topic.id),
    onSuccess: () => {
      setOpen(false);
      void cache.invalidateQueries({ queryKey: topicsKey });
      void cache.invalidateQueries({ queryKey: postsKey });
      toast.success("专题已删除");
    },
  });
  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <Link
        className={buttonVariants({ variant: "ghost", size: "sm" })}
        to={`/topics/${topic.id}`}
      >
        编辑
      </Link>
      {topic.publicPath && (
        <a
          className={buttonVariants({ variant: "ghost", size: "sm" })}
          href={`${publicSiteOrigin}${topic.publicPath}`}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={13} aria-hidden="true" />
          前台
        </a>
      )}
      <ConfirmDialog
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive-surface hover:text-destructive"
          >
            删除
          </Button>
        }
        open={open}
        onOpenChange={(next) => {
          if (next) remove.reset();
          setOpen(next);
        }}
        title={`删除「${topic.title}」？`}
        description={`将永久删除专题并解除 ${topic.articleCount} 篇文章的关联，不会删除文章。`}
        confirmLabel="删除专题"
        pending={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}

const date = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

const columns: ColumnDef<TopicRow>[] = [
  {
    header: "专题",
    accessorKey: "title",
    cell: ({ row: { original: topic } }) => (
      <div className="flex min-w-44 items-center gap-3">
        {topic.coverImage ? (
          <img
            src={topic.coverImage}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-10 shrink-0 rounded-control border border-border object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-control border border-border bg-background text-muted-foreground"
          >
            <Layers size={16} />
          </span>
        )}
        <div className="min-w-0">
          <Link
            className="font-semibold text-foreground underline-offset-4 hover:underline focus-visible:underline"
            to={`/topics/${topic.id}`}
          >
            {topic.title}
          </Link>
          <div className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">
            {topic.description || topic.slug}
          </div>
        </div>
      </div>
    ),
  },
  {
    header: "文章数",
    accessorKey: "articleCount",
    cell: ({ row }) => (
      <span className="inline-flex rounded-md border border-border bg-background px-2 py-0.5 font-mono text-xs font-medium tabular-nums text-foreground">
        {row.original.articleCount} 篇
      </span>
    ),
  },
  {
    header: "顺序",
    accessorKey: "sortOrder",
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {row.original.sortOrder}
      </span>
    ),
  },
  {
    header: "语言版本",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        {(["zh", "en"] as const).map((locale) => (
          <LocaleBadge
            key={locale}
            locale={locale}
            exists={row.original.locales.includes(locale)}
            variant="compact"
          />
        ))}
      </div>
    ),
  },
  {
    header: "更新时间",
    accessorKey: "updatedAt",
    cell: ({ row }) => (
      <time
        dateTime={row.original.updatedAt}
        className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground"
      >
        {date.format(new Date(row.original.updatedAt))}
      </time>
    ),
  },
  { header: "操作", cell: ({ row }) => <TopicActions topic={row.original} /> },
];
const empty: TopicRow[] = [];

export function TopicsPage() {
  const [params, setParams] = useSearchParams();
  const candidate = Number(params.get("page"));
  const page =
    Number.isInteger(candidate) && candidate > 0 && candidate <= 100_000
      ? candidate
      : 1;
  const size = params.get("pageSize");
  const pageSize = size === "10" ? 10 : size === "50" ? 50 : 20;
  const search = (params.get("search") ?? "").slice(0, 200);
  const languageParam = params.get("language");
  const language =
    languageParam === "missing-en" || languageParam === "bilingual"
      ? languageParam
      : undefined;
  const orderParam = params.get("order");
  const order =
    orderParam === "updated" || orderParam === "created"
      ? orderParam
      : "custom";
  const list = useQuery(topicList({ search, page, pageSize, language, order }));
  const total = list.data?.total;
  useEffect(() => {
    if (total === undefined) return;
    const lastPage = Math.max(1, Math.ceil(total / pageSize));
    if (page > lastPage) {
      const next = new URLSearchParams(params);
      next.set("page", String(lastPage));
      setParams(next, { replace: true });
    }
  }, [page, pageSize, params, setParams, total]);

  const table = useReactTable({
    data: list.data?.items ?? empty,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    enableSorting: false,
  });

  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (key !== "page") next.delete("page");
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === "search" });
  }

  function resetFilters() {
    const next = new URLSearchParams(params);
    next.delete("search");
    next.delete("language");
    next.delete("order");
    next.delete("page");
    setParams(next, { replace: true });
  }

  const canReset = Boolean(search || language || order !== "custom");

  return (
    <div className="space-y-5">
      <PageHeader
        title="专题管理"
        description="组织系列文章合集，自定义读者在前台看到的专题顺序与阅读路径。"
        actions={
          <>
            <a
              href={publicSiteOrigin}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <ExternalLink size={15} aria-hidden="true" />
              访问前台
            </a>
            <Link to="/topics/new" className={buttonVariants()}>
              <Plus size={16} aria-hidden="true" />
              新建专题
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="min-w-44 flex-1 sm:max-w-72">
          <SearchInput
            label="搜索专题"
            placeholder="按专题标题搜索…"
            shortcutHint="/"
            maxLength={200}
            value={search}
            onClear={() => change("search", "")}
            onChange={(event) => change("search", event.currentTarget.value)}
          />
        </div>
        <Select
          aria-label="专题语言版本"
          value={language ?? ""}
          onChange={(event) => change("language", event.currentTarget.value)}
        >
          <option value="">全部语言版本</option>
          <option value="missing-en">缺少英文版本</option>
          <option value="bilingual">双语齐全</option>
        </Select>
        <Select
          aria-label="专题排序"
          value={order}
          onChange={(event) => change("order", event.currentTarget.value)}
        >
          <option value="custom">自定义顺序</option>
          <option value="updated">最近更新</option>
          <option value="created">最近创建</option>
        </Select>
        {canReset && (
          <Button
            type="button"
            variant="ghost"
            className="ml-auto text-muted-foreground hover:text-foreground"
            onClick={resetFilters}
          >
            <RotateCcw size={14} aria-hidden="true" />
            重置筛选
          </Button>
        )}
      </div>

      {list.isPending ? (
        <LoadingState message="正在读取专题列表…" />
      ) : list.isError ? (
        <ErrorState
          message={list.error.message}
          onRetry={() => void list.refetch()}
        />
      ) : (
        <DataTable
          table={table}
          label="专题列表"
          empty={
            <EmptyState
              title={search || language ? "没有符合条件的专题" : "暂无专题"}
              description={
                search || language
                  ? "试试其他关键词或语言状态筛选。"
                  : "新建专题后会在这里显示。"
              }
              action={
                search || language ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetFilters}
                  >
                    清除筛选条件
                  </Button>
                ) : (
                  <Link
                    to="/topics/new"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    <Plus size={15} aria-hidden="true" />
                    新建第一个专题
                  </Link>
                )
              }
            />
          }
          footer={
            <Pagination
              page={page}
              pageSize={pageSize}
              total={list.data.total}
              showPageNumbers
              onPageChange={(value) => change("page", String(value))}
              onPageSizeChange={(value) => change("pageSize", String(value))}
            />
          }
        />
      )}
    </div>
  );
}
