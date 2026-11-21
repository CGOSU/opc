import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { DataTable } from "../components/admin/data-table";
import { PageHeader } from "../components/admin/page-header";
import { Pagination, type PageSize } from "../components/admin/pagination";
import { SearchInput } from "../components/admin/search-input";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/admin/states";
import { Button } from "../components/ui/button";
import {
  taxonomyKey,
  termListQuery,
  type TaxonomyKind,
  type Term,
} from "./api";
import { DeleteTerm } from "./delete-term";
import { TermEditor } from "./term-editor";

const emptyTerms: Term[] = [];

export function TaxonomyPage({ kind }: { kind: TaxonomyKind }) {
  const isCategory = kind === "categories";
  const label = isCategory ? "分类" : "标签";
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [language, setLanguage] = useState<"" | "missing-en" | "bilingual">("");
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [editor, setEditor] = useState<{ term: Term | null } | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const list = useQuery(
    termListQuery(kind, {
      search,
      language: language || undefined,
      page,
      pageSize,
    }),
  );

  const total = list.data?.total;
  useEffect(() => {
    if (total !== undefined) {
      const lastPage = Math.max(1, Math.ceil(total / pageSize));
      if (page > lastPage) setPage(lastPage);
    }
  }, [total, page, pageSize]);

  function applySearch(value: string) {
    setSearch(value.trim());
    setPage(1);
  }

  const openEditor = useCallback((term: Term | null, trigger: HTMLElement) => {
    returnFocus.current = trigger;
    setEditor({ term });
  }, []);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: taxonomyKey(kind) });
  }, [kind, queryClient]);

  const columns = useMemo(() => {
    const result: ColumnDef<Term>[] = [
      {
        accessorKey: "name",
        header: "名称",
        cell: ({ row: { original } }) => (
          <div className="min-w-32 max-w-80 space-y-0.5 wrap-anywhere">
            <p className="font-medium">{original.name}</p>
            <p className="line-clamp-2 text-muted-foreground">
              {original.translations.find((version) => version.locale === "en")
                ?.name ?? (original.legacy ? "含历史内容" : "")}
            </p>
          </div>
        ),
      },
      {
        id: "languages",
        header: "语言版本",
        cell: ({ row }) => (
          <div className="flex gap-1">
            {(["zh", "en"] as const).map((locale) => {
              const exists = row.original.translations.some(
                (version) => version.locale === locale,
              );
              const state = exists ? "已创建" : "未创建";
              return (
                <span
                  key={locale}
                  title={state}
                  className={
                    exists
                      ? "rounded-control bg-muted px-2 py-0.5 font-medium"
                      : "rounded-control border border-dashed border-border px-2 py-0.5 text-muted-foreground"
                  }
                >
                  {locale.toUpperCase()}
                  <span className="sr-only"> {state}</span>
                </span>
              );
            })}
          </div>
        ),
      },
      {
        accessorKey: "articleCount",
        header: "文章数",
        cell: ({ row }) => (
          <Link
            to={`/posts?${isCategory ? "categoryId" : "tagId"}=${encodeURIComponent(row.original.id)}`}
            className="whitespace-nowrap tabular-nums text-primary underline-offset-4 hover:underline"
            aria-label={`查看 ${row.original.name} 的 ${row.original.articleCount} 篇文章`}
          >
            {row.original.articleCount}
          </Link>
        ),
      },
    ];
    if (isCategory) {
      result.push({
        accessorKey: "sortOrder",
        header: "排序值",
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {row.original.sortOrder}
          </span>
        ),
      });
    }
    result.push({
      id: "actions",
      header: "操作",
      cell: ({ row: { original } }) => (
        <div className="flex items-center gap-1 whitespace-nowrap">
          <Button
            type="button"
            variant="ghost"
            aria-label={`编辑${label}：${original.name}`}
            onClick={(event) => openEditor(original, event.currentTarget)}
          >
            编辑
          </Button>
          <DeleteTerm
            kind={kind}
            term={original}
            label={label}
            onDeleted={async () => {
              toast.success(`${label}已删除`);
              await refresh();
              addButton.current?.focus();
            }}
          />
        </div>
      ),
    });

    return result;
  }, [isCategory, kind, label, openEditor, refresh]);

  const table = useReactTable({
    data: list.data?.items ?? emptyTerms,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <section className="space-y-6">
      <PageHeader
        title={`${label}管理`}
        description={
          isCategory
            ? "每篇文章最多一个分类；有关联文章的分类不可删除。"
            : "每篇文章可关联多个标签；删除标签仅解除关联，不删除文章。"
        }
        actions={
          <Button
            ref={addButton}
            type="button"
            onClick={(event) => openEditor(null, event.currentTarget)}
          >
            <Plus size={16} aria-hidden="true" />
            新建{label}
          </Button>
        }
      />
      {list.data && (
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            [`${label}总数`, list.data.counts.shared],
            ["中文版本", list.data.counts.zh],
            ["英文版本", list.data.counts.en],
            ["缺少英文版", list.data.counts.shared - list.data.counts.en],
          ].map(([name, count]) => (
            <div
              key={name}
              className="rounded-panel border border-border bg-card p-4"
            >
              <dt className="text-muted-foreground">{name}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">
                {count}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <form
        role="search"
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          applySearch(input);
        }}
      >
        <SearchInput
          label={`搜索${label}名称`}
          name="search"
          maxLength={100}
          className="w-full sm:w-64"
          placeholder={`搜索${label}名称`}
          value={input}
          onChange={(event) => setInput(event.currentTarget.value)}
        />
        <Button type="submit" variant="outline">
          搜索
        </Button>
        <select
          aria-label="语言状态"
          className="h-9 rounded-control border border-input bg-card px-3"
          value={language}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setLanguage(
              value === "missing-en" || value === "bilingual" ? value : "",
            );
            setPage(1);
          }}
        >
          <option value="">全部语言状态</option>
          <option value="missing-en">缺少英文版</option>
          <option value="bilingual">双语齐全</option>
        </select>
        {(search || language) && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setInput("");
              setLanguage("");
              applySearch("");
            }}
          >
            清除筛选
          </Button>
        )}
      </form>
      {list.isPending ? (
        <LoadingState />
      ) : list.isError ? (
        <ErrorState
          message={list.error.message}
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
        />
      ) : (
        <div className="space-y-4" aria-busy={list.isFetching}>
          <DataTable
            table={table}
            label={`${label}列表`}
            empty={
              search || language ? (
                <EmptyState
                  title={`没有符合条件的${label}`}
                  description="试试其他关键词，或清除筛选查看所有记录。"
                />
              ) : (
                <EmptyState
                  title={`暂无${label}`}
                  description={`通过“新建${label}”添加第一条记录。`}
                />
              )
            }
          />
          {list.data.total > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={list.data.total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          )}
        </div>
      )}
      {editor && (
        <TermEditor
          kind={kind}
          label={label}
          term={editor.term}
          returnFocus={returnFocus}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            toast.success(`${label}已保存`);
            await refresh();
          }}
        />
      )}
    </section>
  );
}
