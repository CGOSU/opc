import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { DataTable } from "../components/admin/data-table";
import { LocaleBadge } from "../components/admin/locale-badge";
import { PageHeader } from "../components/admin/page-header";
import { Pagination, type PageSize } from "../components/admin/pagination";
import { SearchInput } from "../components/admin/search-input";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/admin/states";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
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
        cell: ({ row: { original } }) => {
          const enTranslation = original.translations.find(
            (version) => version.locale === "en",
          );
          return (
            <div className="min-w-36 max-w-96 space-y-0.5 wrap-anywhere">
              <p className="font-semibold text-foreground">{original.name}</p>
              {(enTranslation?.name || original.legacy) && (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {enTranslation?.name ?? (original.legacy ? "含历史未标记内容" : "")}
                </p>
              )}
            </div>
          );
        },
      },
      {
        id: "languages",
        header: "语言版本",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            {(["zh", "en"] as const).map((locale) => {
              const exists = row.original.translations.some(
                (version) => version.locale === locale,
              );
              return (
                <LocaleBadge
                  key={locale}
                  locale={locale}
                  exists={exists}
                  variant="compact"
                />
              );
            })}
          </div>
        ),
      },
      {
        accessorKey: "articleCount",
        header: "关联文章",
        cell: ({ row }) => (
          <Link
            to={`/posts?${isCategory ? "categoryId" : "tagId"}=${encodeURIComponent(row.original.id)}`}
            className="inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 font-mono text-xs font-medium tabular-nums text-foreground transition-colors hover:border-input hover:bg-accent"
            aria-label={`查看 ${row.original.name} 的 ${row.original.articleCount} 篇文章`}
          >
            {row.original.articleCount} 篇
          </Link>
        ),
      },
    ];
    if (isCategory) {
      result.push({
        accessorKey: "sortOrder",
        header: "排序值",
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
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
            size="sm"
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

  const canReset = Boolean(search || language || input);

  return (
    <section className="space-y-5">
      <PageHeader
        title={`${label}管理`}
        description={
          isCategory
            ? "统一维护中英文分类名称、SEO 描述与排序；有关联文章的分类不可删除。"
            : "统一维护中英文标签与 SEO 描述；删除标签仅解除文章关联，不删除文章。"
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
        <dl className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          {[
            [`${label}总数`, list.data.counts.shared],
            ["中文版本", list.data.counts.zh],
            ["英文版本", list.data.counts.en],
            ["缺少英文版", list.data.counts.shared - list.data.counts.en],
          ].map(([name, count]) => (
            <div
              key={name}
              className="rounded-panel border border-border bg-card px-4 py-3.5 shadow-[0_1px_2px_rgba(24,24,27,0.03)]"
            >
              <dt className="text-xs font-medium text-muted-foreground">
                {name}
              </dt>
              <dd className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums text-foreground">
                {count}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <form
        role="search"
        className="flex flex-wrap items-center gap-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          applySearch(input);
        }}
      >
        <div className="min-w-44 flex-1 sm:max-w-72">
          <SearchInput
            label={`搜索${label}名称`}
            name="search"
            maxLength={100}
            shortcutHint="/"
            placeholder={`搜索${label}名称…`}
            value={input}
            onClear={() => {
              setInput("");
              applySearch("");
            }}
            onChange={(event) => setInput(event.currentTarget.value)}
          />
        </div>
        <Button type="submit" variant="outline">
          搜索
        </Button>
        <Select
          aria-label="语言状态"
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
        </Select>
        {canReset && (
          <Button
            type="button"
            variant="ghost"
            className="ml-auto text-muted-foreground hover:text-foreground"
            onClick={() => {
              setInput("");
              setLanguage("");
              applySearch("");
            }}
          >
            <RotateCcw size={14} aria-hidden="true" />
            清除筛选
          </Button>
        )}
      </form>

      {list.isPending ? (
        <LoadingState message={`正在读取${label}列表…`} />
      ) : list.isError ? (
        <ErrorState
          message={list.error.message}
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
        />
      ) : (
        <div aria-busy={list.isFetching}>
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
            footer={
              list.data.total > 0 ? (
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={list.data.total}
                  showPageNumbers
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              ) : undefined
            }
          />
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
