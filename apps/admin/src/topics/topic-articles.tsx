import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Search } from "lucide-react";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import {
  ErrorState,
  LoadingState,
  EmptyState,
} from "../components/admin/states";
import { SortableList } from "../components/admin/sortable-list";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { postList, postsKey } from "../posts/api";
import {
  saveTopicOrder,
  topicsKey,
  type TopicArticle,
  type TopicDetail,
} from "./api";

function ArticleSelector({
  articles,
  disabled,
  onAdd,
}: {
  articles: TopicArticle[];
  disabled: boolean;
  onAdd: (item: TopicArticle) => void;
}) {
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const query = postList({ search: submitted, pageSize: 20 });
  const results = useQuery({ ...query, enabled: !!submitted });
  // Translations represent the same article in a topic.
  const candidates = Array.from(
    new Map(results.data?.items.map((post) => [post.contentId, post])).values(),
  );
  return (
    <div className="space-y-2.5">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(search.trim());
        }}
      >
        <div className="relative flex-1">
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            maxLength={200}
            aria-label="搜索可添加的文章"
            className="pl-9"
            value={search}
            placeholder="输入文章标题关键词，搜索已发布文章…"
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
        </div>
        <Button type="submit" variant="outline" disabled={!search.trim()}>
          搜索
        </Button>
      </form>
      {submitted &&
        (results.isPending ? (
          <LoadingState message="正在搜索文章…" />
        ) : results.isError ? (
          <ErrorState
            message={results.error.message}
            onRetry={() => void results.refetch()}
          />
        ) : candidates.length ? (
          <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-control border border-border bg-background/50">
            {candidates.map((post) => {
              const isAdded = articles.some(({ id }) => id === post.contentId);
              return (
                <li
                  key={post.contentId}
                  className="flex min-h-11 items-center justify-between gap-3 px-3.5 py-2 text-sm"
                >
                  <span className="min-w-0 font-medium text-foreground break-words">
                    {post.title}
                  </span>
                  <Button
                    type="button"
                    variant={isAdded ? "ghost" : "outline"}
                    size="sm"
                    disabled={isAdded || disabled || articles.length >= 1000}
                    onClick={() =>
                      onAdd({
                        id: post.contentId,
                        title: post.title,
                        path: post.path,
                        locales: [post.locale],
                      })
                    }
                  >
                    {!isAdded && <Plus size={13} aria-hidden="true" />}
                    {isAdded ? "已添加" : "添加"}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">没有匹配的文章。</p>
        ))}
      {submitted &&
        results.data &&
        results.data.total > results.data.items.length && (
          <p className="text-xs text-muted-foreground">
            仅显示前 20 条匹配结果，可缩小搜索范围。
          </p>
        )}
    </div>
  );
}

export function TopicArticles({
  topic,
  locale,
}: {
  topic: TopicDetail;
  locale: "zh" | "en";
}) {
  const cache = useQueryClient();
  const [draft, setDraft] = useState<TopicArticle[] | null>(null);
  const articles = draft ?? topic.articles;
  const dirty =
    !!draft &&
    (draft.length !== topic.articles.length ||
      draft.some(({ id }, index) => id !== topic.articles[index]?.id));
  const save = useMutation({
    mutationFn: () => saveTopicOrder(topic.id, articles),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: topicsKey }),
        cache.invalidateQueries({ queryKey: postsKey }),
      ]);
      setDraft(null);
      toast.success("文章顺序已保存");
    },
  });
  const localizedCount = topic.articles.filter((article) =>
    article.locales.includes(locale),
  ).length;

  return (
    <section aria-labelledby="topic-articles" className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-4">
        <div>
          <h2 id="topic-articles" className="text-base font-semibold text-foreground">
            专题文章
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            关联和排序对所有语言共享；支持拖拽手柄或方向按钮调整顺序。
          </p>
        </div>
        <span className="rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs tabular-nums text-muted-foreground">
          当前语言可展示{" "}
          <strong className="font-semibold text-foreground">
            {localizedCount}
          </strong>{" "}
          / {topic.articles.length} 篇
        </span>
      </div>
      <ArticleSelector
        articles={articles}
        disabled={save.isPending}
        onAdd={(item) => setDraft([...articles, item])}
      />
      {articles.length ? (
        <SortableList
          items={articles}
          onChange={setDraft}
          disabled={save.isPending}
        >
          {(article) => {
            const index = articles.findIndex(({ id }) => id === article.id);
            const missingLocale = topic.articles.some(
              (saved) =>
                saved.id === article.id && !saved.locales.includes(locale),
            );
            return (
              <>
                <span className="min-w-0 flex-1 py-2 break-words">
                  <span className="font-medium text-foreground">
                    {article.title}
                  </span>
                  {missingLocale && (
                    <span className="mt-0.5 block text-xs text-warning">
                      当前语言尚无公开版本
                    </span>
                  )}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={save.isPending || index === 0}
                  aria-label={`上移「${article.title}」`}
                  onClick={() =>
                    setDraft(arrayMove(articles, index, index - 1))
                  }
                >
                  <ArrowUp size={15} aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={save.isPending || index === articles.length - 1}
                  aria-label={`下移「${article.title}」`}
                  onClick={() =>
                    setDraft(arrayMove(articles, index, index + 1))
                  }
                >
                  <ArrowDown size={15} aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive-surface hover:text-destructive"
                  disabled={save.isPending}
                  aria-label={`移除「${article.title}」`}
                  onClick={() =>
                    setDraft(articles.filter(({ id }) => id !== article.id))
                  }
                >
                  移除
                </Button>
              </>
            );
          }}
        </SortableList>
      ) : (
        <EmptyState title="尚未收录文章" description="通过上方搜索并添加已发布文章。" />
      )}
      {save.error && <ErrorState message={save.error.message} />}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "正在保存…" : "保存文章关系"}
          </Button>
          {dirty && (
            <Button
              type="button"
              variant="ghost"
              disabled={save.isPending}
              onClick={() => {
                save.reset();
                setDraft(null);
              }}
            >
              撤销未保存修改
            </Button>
          )}
        </div>
        {dirty && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-border bg-warning-surface px-2.5 py-0.5 text-xs font-medium text-warning">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-warning"
            />
            文章列表有未保存修改
          </span>
        )}
      </div>
    </section>
  );
}
