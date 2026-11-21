import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { ConfirmDialog } from "../components/admin/confirm-dialog";
import { DataTable } from "../components/admin/data-table";
import { PageHeader } from "../components/admin/page-header";
import { Pagination } from "../components/admin/pagination";
import { ErrorState, LoadingState } from "../components/admin/states";
import { Button, buttonVariants } from "../components/ui/button";
import { Input } from "../components/ui/input";
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
  const site =
    import.meta.env.VITE_PUBLIC_SITE_ORIGIN || "http://localhost:4321";
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
          href={`${site}${topic.publicPath}`}
          target="_blank"
          rel="noreferrer"
        >
          前台
        </a>
      )}
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="sm">
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
      <div className="flex min-w-40 items-center gap-3">
        {topic.coverImage && (
          <img
            src={topic.coverImage}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-10 shrink-0 rounded-md object-cover"
          />
        )}
        <div className="min-w-0">
          <Link
            className="font-medium hover:underline"
            to={`/topics/${topic.id}`}
          >
            {topic.title}
          </Link>
          <div className="line-clamp-2 break-words text-xs text-muted-foreground">
            {topic.description || topic.slug}
          </div>
        </div>
      </div>
    ),
  },
  { header: "文章数", accessorKey: "articleCount" },
  { header: "顺序", accessorKey: "sortOrder" },
  {
    header: "语言版本",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1.5">
        {(["zh", "en"] as const).map((locale) => {
          const exists = row.original.locales.includes(locale);
          return (
            <span
              key={locale}
              className="rounded-md border border-border px-1.5 py-0.5 text-xs"
              aria-label={`${locale.toUpperCase()} ${exists ? "已发布" : "未创建"}`}
            >
              {locale.toUpperCase()} {exists ? "✓" : "＋"}
            </span>
          );
        })}
      </div>
    ),
  },
  {
    header: "更新时间",
    accessorKey: "updatedAt",
    cell: ({ row }) => date.format(new Date(row.original.updatedAt)),
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
  return (
    <div className="space-y-5">
      <PageHeader
        title="专题管理"
        description="组织系列文章，设置读者在前台看到的阅读顺序。"
        actions={
          <Link to="/topics/new" className={buttonVariants()}>
            新建专题
          </Link>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="w-full sm:w-64"
          type="search"
          aria-label="搜索专题"
          placeholder="按专题标题搜索"
          maxLength={200}
          value={search}
          onChange={(event) => change("search", event.currentTarget.value)}
        />
        <select
          className="h-9 rounded-md border border-input bg-background px-2"
          aria-label="专题语言版本"
          value={language ?? ""}
          onChange={(event) => change("language", event.currentTarget.value)}
        >
          <option value="">全部语言版本</option>
          <option value="missing-en">缺少英文版本</option>
          <option value="bilingual">双语齐全</option>
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-2"
          aria-label="专题排序"
          value={order}
          onChange={(event) => change("order", event.currentTarget.value)}
        >
          <option value="custom">自定义顺序</option>
          <option value="updated">最近更新</option>
          <option value="created">最近创建</option>
        </select>
      </div>
      {list.isPending ? (
        <LoadingState />
      ) : list.isError ? (
        <ErrorState
          message={list.error.message}
          onRetry={() => void list.refetch()}
        />
      ) : (
        <>
          <DataTable table={table} label="专题列表" />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={list.data.total}
            onPageChange={(value) => change("page", String(value))}
            onPageSizeChange={(value) => change("pageSize", String(value))}
          />
        </>
      )}
    </div>
  );
}
