import { useQuery } from "@tanstack/react-query";
import { ListFilter, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { SearchInput } from "../components/admin/search-input";
import { ErrorState } from "../components/admin/states";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { cn } from "../lib/utils";
import { topicOptions } from "../topics/api";
import { termOptions } from "./api";

export function PostFilters({
  search,
  onSearch,
  filters,
  onChange,
  onReset,
}: {
  search: string;
  onSearch: (value: string) => void;
  filters: {
    categoryId?: string;
    tagId?: string;
    topicId?: string;
    locale?: string;
    sort: string;
    order: string;
  };
  onChange: (values: Record<string, string>) => void;
  onReset: (() => void) | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const filtersId = useId();
  const { categoryId, tagId, topicId, locale, sort, order } = filters;
  const categories = useQuery(termOptions("categories"));
  const tags = useQuery(termOptions("tags"));
  const topics = useQuery(topicOptions());
  const termFilters = [
    { key: "categoryId", label: "分类", value: categoryId, query: categories },
    { key: "tagId", label: "标签", value: tagId, query: tags },
  ];

  return (
    <>
      <div className="flex flex-wrap items-start gap-2.5 lg:items-center">
        <div className="min-w-44 flex-1 lg:max-w-76">
          <SearchInput
            label="按标题搜索"
            placeholder="搜索文章标题…"
            shortcutHint="/"
            maxLength={200}
            value={search}
            onClear={() => onSearch("")}
            onChange={(event) => onSearch(event.currentTarget.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="lg:hidden"
          aria-controls={filtersId}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <ListFilter size={16} aria-hidden="true" /> 筛选
        </Button>
        <div
          id={filtersId}
          className={cn(
            "w-full grid-cols-2 gap-2.5 rounded-panel border border-border bg-card p-3 shadow-[0_1px_2px_rgba(24,24,27,0.03)] lg:flex lg:w-auto lg:flex-wrap lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none",
            expanded ? "grid" : "hidden",
          )}
        >
          {termFilters.map(({ key, label, value, query }) => (
            <Select
              key={key}
              aria-label={label}
              value={value ?? ""}
              onChange={(event) =>
                onChange({ [key]: event.currentTarget.value })
              }
            >
              <option value="">全部{label}</option>
              {value && !query.data?.some(({ id }) => id === value) && (
                <option value={value}>已选{label}</option>
              )}
              {query.data?.map((term) => (
                <option key={term.id} value={term.id} label={term.name} />
              ))}
            </Select>
          ))}
          <Select
            aria-label="专题"
            value={topicId ?? ""}
            onChange={(event) =>
              onChange({ topicId: event.currentTarget.value })
            }
          >
            <option value="">全部专题</option>
            {topicId && !topics.data?.some(({ id }) => id === topicId) && (
              <option value={topicId}>已选专题</option>
            )}
            {topics.data?.map(({ id, title }) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </Select>
          <Select
            aria-label="语言"
            value={locale ?? ""}
            onChange={(event) =>
              onChange({ locale: event.currentTarget.value })
            }
          >
            <option value="">全部语言</option>
            <option value="zh">中文</option>
            <option value="en">English</option>
          </Select>
          <Select
            aria-label="时间排序"
            value={`${sort}:${order}`}
            onChange={(event) => {
              const [nextSort, nextOrder] =
                event.currentTarget.value.split(":");
              onChange({ sort: nextSort, order: nextOrder });
            }}
          >
            <option value="updated:desc">更新：最新优先</option>
            <option value="updated:asc">更新：最早优先</option>
            <option value="created:desc">创建：最新优先</option>
            <option value="created:asc">创建：最早优先</option>
          </Select>
        </div>
        {onReset && (
          <Button
            type="button"
            variant="ghost"
            className="ml-auto text-muted-foreground hover:text-foreground"
            onClick={onReset}
          >
            <RotateCcw size={14} aria-hidden="true" /> 重置筛选
          </Button>
        )}
      </div>
      {(categories.isError || tags.isError || topics.isError) && (
        <ErrorState
          message="无法加载分类、标签或专题选项。"
          onRetry={() => {
            if (categories.isError) void categories.refetch();
            if (tags.isError) void tags.refetch();
            if (topics.isError) void topics.refetch();
          }}
        />
      )}
    </>
  );
}
