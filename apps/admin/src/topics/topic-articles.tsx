import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
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
    <div className="space-y-2">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(search.trim());
        }}
      >
        <Input
          type="search"
          maxLength={200}
          aria-label="搜索可添加的文章"
          value={search}
          placeholder="按文章标题搜索"
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        <Button type="submit" variant="outline" disabled={!search.trim()}>
          搜索
        </Button>
      </form>
      {submitted &&
        (results.isPending ? (
          <LoadingState />
        ) : results.isError ? (
          <ErrorState
            message={results.error.message}
            onRetry={() => void results.refetch()}
          />
        ) : candidates.length ? (
          <ul className="max-h-52 overflow-y-auto rounded-lg border border-border">
            {candidates.map((post) => {
              const isAdded = articles.some(({ id }) => id === post.contentId);
              return (
                <li
                  key={post.contentId}
                  className="flex min-h-11 items-center justify-between gap-3 border-b border-border px-3 last:border-b-0"
                >
                  <span className="min-w-0 break-words">{post.title}</span>
                  <Button
                    type="button"
                    variant="ghost"
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
                    {isAdded ? "已添加" : "添加"}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground">没有匹配的文章。</p>
        ))}
      {submitted &&
        results.data &&
        results.data.total > results.data.items.length && (
          <p className="text-muted-foreground">
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
  return (
    <section aria-labelledby="topic-articles" className="min-w-0 space-y-4">
      <div>
        <h2 id="topic-articles" className="text-lg font-semibold">
          专题文章
        </h2>
        <p className="text-muted-foreground">
          关联和顺序对所有语言共享；已保存的文章中，当前语言可展示{" "}
          {
            topic.articles.filter((article) => article.locales.includes(locale))
              .length
          }{" "}
          / {topic.articles.length} 篇。
        </p>
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
            return (
              <>
                <span className="min-w-0 flex-1 break-words">
                  {article.title}
                  {topic.articles.some(
                    (saved) =>
                      saved.id === article.id &&
                      !saved.locales.includes(locale),
                  ) && (
                    <span className="block text-xs text-muted-foreground">
                      当前语言无公开版本
                    </span>
                  )}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={save.isPending || index === 0}
                  aria-label={`上移「${article.title}」`}
                  onClick={() =>
                    setDraft(arrayMove(articles, index, index - 1))
                  }
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={save.isPending || index === articles.length - 1}
                  aria-label={`下移「${article.title}」`}
                  onClick={() =>
                    setDraft(arrayMove(articles, index, index + 1))
                  }
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
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
        <EmptyState title="尚未收录文章" description="搜索并添加已发布文章。" />
      )}
      {save.error && <ErrorState message={save.error.message} />}
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
    </section>
  );
}
