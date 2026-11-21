import { useQuery } from "@tanstack/react-query";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { ExternalLink, FileText, Plus, Search } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { DataTable } from "../components/admin/data-table";
import { PageHeader } from "../components/admin/page-header";
import { Pagination } from "../components/admin/pagination";
import { EmptyState, ErrorState } from "../components/admin/states";
import { Button, buttonVariants } from "../components/ui/button";
import { publicSiteOrigin } from "../lib/admin-api";
import { postList, type PostRow } from "./api";
import { postColumnClass, postColumns } from "./post-columns";
import { PostFilters } from "./post-filters";

const empty: PostRow[] = [];
const skeletonRows = [0, 1, 2, 3, 4];

function PostListSkeleton() {
  return (
    <div
      role="status"
      className="overflow-hidden rounded-panel border border-border bg-card shadow-[0_1px_3px_rgba(24,24,27,0.04)]"
    >
      <p className="sr-only">正在读取文章…</p>
      <div
        aria-hidden="true"
        className="divide-y divide-border motion-safe:animate-pulse"
      >
        <div className="h-10.5 bg-background/90" />
        {skeletonRows.map((row) => (
          <div
            key={row}
            className="flex h-[4.5rem] items-center justify-between gap-8 px-4"
          >
            <div className="w-2/3 max-w-72 space-y-2">
              <div className="h-3.5 w-3/4 rounded bg-accent" />
              <div className="h-2.5 w-full rounded bg-accent" />
            </div>
            <div className="h-3.5 w-20 rounded bg-accent" />
          </div>
        ))}
      </div>
    </div>
  );
}

function useSearchDraft(search: string, onCommit: (value: string) => void) {
  const [draft, setDraft] = useState({ source: search, value: search });
  const save = useEffectEvent(onCommit);
  const value = draft.source === search ? draft.value : search;
  if (draft.source !== search) setDraft({ source: search, value: search });
  useEffect(() => {
    if (value === search) return;
    const timer = window.setTimeout(() => save(value), 300);
    return () => window.clearTimeout(timer);
  }, [search, value]);
  return [
    value,
    (next: string) => setDraft({ source: search, value: next }),
  ] as const;
}

export default function PostsPage() {
  const [params, setParams] = useSearchParams();
  const candidate = Number(params.get("page"));
  const page =
    Number.isInteger(candidate) && candidate > 0 && candidate <= 100_000
      ? candidate
      : 1;
  const size = params.get("pageSize");
  const pageSize = size === "10" ? 10 : size === "50" ? 50 : 20;
  const search = (params.get("search") ?? "").slice(0, 200);
  const categoryId = params.get("categoryId")?.slice(0, 200) || undefined;
  const tagId = params.get("tagId")?.slice(0, 200) || undefined;
  const topicId = params.get("topicId")?.slice(0, 200) || undefined;
  const sort = params.get("sort") === "created" ? "created" : "updated";
  const order = params.get("order") === "asc" ? "asc" : "desc";
  const localeParam = params.get("locale");
  const locale =
    localeParam === "zh" || localeParam === "en" ? localeParam : undefined;
  const filters = { categoryId, tagId, topicId, locale, sort, order } as const;
  const list = useQuery(postList({ page, pageSize, search, ...filters }));
  const total = list.data?.total;
  const lastPage =
    total === undefined ? undefined : Math.max(1, Math.ceil(total / pageSize));
  const needsPageCorrection = lastPage !== undefined && page > lastPage;
  useEffect(() => {
    if (!needsPageCorrection) return;
    const next = new URLSearchParams(params);
    next.set("page", String(lastPage));
    setParams(next, { replace: true });
  }, [lastPage, needsPageCorrection, params, setParams]);

  function change(values: Record<string, string>, replace = false) {
    const next = new URLSearchParams(params);
    if (!("page" in values)) next.delete("page");
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (next.toString() !== params.toString()) setParams(next, { replace });
  }

  const [draft, setDraft] = useSearchDraft(search, (value) =>
    change({ search: value }, true),
  );
  const filtered = Boolean(search || categoryId || tagId || topicId || locale);
  const canReset =
    filtered || Boolean(draft) || sort !== "updated" || order !== "desc";
  function reset() {
    setDraft("");
    change({
      search: "",
      categoryId: "",
      tagId: "",
      topicId: "",
      locale: "",
      sort: "",
      order: "",
    });
  }

  const sorting =
    sort === "updated" ? [{ id: "updatedAt", desc: order === "desc" }] : [];
  const table = useReactTable({
    data: list.data?.items ?? empty,
    columns: postColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    state: { sorting },
    manualSorting: true,
    enableSortingRemoval: false,
    onSortingChange(updater) {
      const [next] = typeof updater === "function" ? updater(sorting) : updater;
      if (next) change({ sort: "updated", order: next.desc ? "desc" : "asc" });
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="文章管理"
        description="集中管理中英文技术文章、专题关联与 SEO 元信息，保存后即时生效。"
        actions={
          <>
            <a
              href={publicSiteOrigin}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              <ExternalLink size={15} aria-hidden="true" /> 访问前台
            </a>
            <Link to="/posts/new" className={buttonVariants()}>
              <Plus size={16} aria-hidden="true" /> 新建文章
            </Link>
          </>
        }
      />
      <PostFilters
        search={draft}
        onSearch={setDraft}
        filters={filters}
        onChange={change}
        onReset={canReset ? reset : undefined}
      />
      {list.isPending || needsPageCorrection ? (
        <PostListSkeleton />
      ) : list.isError ? (
        <ErrorState
          message={list.error.message}
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
        />
      ) : (
        <DataTable
          table={table}
          label="文章列表"
          columnClassName={postColumnClass}
          rowClassName="h-[4.5rem]"
          empty={
            <EmptyState
              title={filtered ? "没有符合条件的文章" : "暂无文章"}
              description={
                filtered
                  ? "试试其他关键词，或重置筛选条件。"
                  : "新建文章后会在这里显示。"
              }
              action={
                <div className="space-y-3">
                  {filtered ? (
                    <Button type="button" variant="outline" onClick={reset}>
                      <Search size={15} aria-hidden="true" /> 清除筛选条件
                    </Button>
                  ) : (
                    <Link
                      to="/posts/new"
                      className={buttonVariants({ variant: "outline" })}
                    >
                      <FileText size={15} aria-hidden="true" /> 新建第一篇文章
                    </Link>
                  )}
                </div>
              }
            />
          }
          footer={
            <Pagination
              page={page}
              pageSize={pageSize}
              total={list.data.total}
              showPageNumbers
              onPageChange={(page) => change({ page: String(page) })}
              onPageSizeChange={(size) => change({ pageSize: String(size) })}
            />
          }
        />
      )}
    </div>
  );
}
