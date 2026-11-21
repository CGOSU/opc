import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Sparkles } from "lucide-react";
import { useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Link,
  useBeforeUnload,
  useBlocker,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import { toast } from "sonner";
import { ConfirmDialog } from "../components/admin/confirm-dialog";
import { LocaleBadge } from "../components/admin/locale-badge";
import { PageHeader } from "../components/admin/page-header";
import { ErrorState, LoadingState } from "../components/admin/states";
import { Button, buttonVariants } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { cn } from "../lib/utils";
import { AdminRequestError, taxonomyKey, type Term } from "../taxonomy/api";
import { topicOptions, topicsKey, type TopicRow } from "../topics/api";
import {
  createPost,
  createTranslation,
  postDetail,
  postsKey,
  reloadTranslation,
  savePostSettings,
  saveTranslation,
  termOptions,
  type PostDetail,
  type PostInput,
  type PostSettings,
  type TranslationInput,
} from "./api";
import { MarkdownEditor } from "./markdown-editor";
import { PostSettingsForm } from "./post-settings-form";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const localeMeta = {
  zh: "中文 · ZH",
  en: "English · EN",
} as const;
const locales = ["zh", "en"] as const;
type TranslationFields = TranslationInput & Pick<PostInput, "locale">;

function languageDefaults(post?: PostDetail): TranslationFields {
  return {
    locale: post?.locale ?? "zh",
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    summary: post?.summary ?? "",
    content: post?.content ?? "",
    seoTitle: post?.seoTitle ?? "",
    seoDescription: post?.seoDescription ?? "",
  };
}

function normalizeSettings(values: PostSettings): PostSettings {
  return {
    ...values,
    categoryId: values.categoryId || null,
    coverImage: values.coverImage?.trim() || null,
  };
}

export default function PostEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const sourceId = id ?? params.get("from") ?? undefined;
  const post = useQuery(postDetail(sourceId));
  const categories = useQuery(termOptions("categories"));
  const tags = useQuery(termOptions("tags"));
  const topics = useQuery(topicOptions());
  if (
    (sourceId && post.isError && !post.data) ||
    (categories.isError && !categories.data) ||
    (tags.isError && !tags.data) ||
    (topics.isError && !topics.data)
  )
    return (
      <ErrorState
        message="无法打开文章编辑器。"
        onRetry={() => {
          if (sourceId) void post.refetch();
          void categories.refetch();
          void tags.refetch();
          void topics.refetch();
        }}
      />
    );
  if (
    (sourceId && post.isPending) ||
    !categories.data ||
    !tags.data ||
    !topics.data
  )
    return <LoadingState message="正在打开文章编辑器…" />;
  return (
    <Editor
      key={id ?? `new:${sourceId ?? ""}`}
      post={post.data}
      creating={!id}
      categories={categories.data}
      tags={tags.data}
      topics={topics.data}
    />
  );
}

function Editor({
  post,
  creating,
  categories,
  tags,
  topics,
}: {
  post?: PostDetail;
  creating: boolean;
  categories: Term[];
  tags: Term[];
  topics: TopicRow[];
}) {
  const other = post?.locale === "zh" ? "en" : "zh";
  const alternative = post?.translations.find(({ locale }) => locale === other);
  const hasNoLocale = useRef(creating && !!alternative).current;
  const {
    register,
    control,
    setValue,
    getValues,
    watch,
    handleSubmit,
    reset,
    formState: { isDirty: languageDirty, errors },
  } = useForm<TranslationFields>({
    defaultValues: creating
      ? { ...languageDefaults(), locale: post ? other : "zh" }
      : languageDefaults(post),
  });
  const settings = useForm<PostSettings>({
    defaultValues: {
      coverImage: creating ? "" : (post?.sharedCoverImage ?? null),
      categoryId: post?.categoryId ?? "",
      tagIds: post?.tags.map(({ id }) => id) ?? [],
      topicIds: post?.topics.map(({ id }) => id) ?? [],
    },
  });
  const {
    formState: { isDirty: settingsDirty, dirtyFields },
  } = settings;
  const isDirty = languageDirty || settingsDirty;
  // Keep the revision that initialized this draft, not a background query's revision.
  const revision = useRef(post?.revision);
  const cache = useQueryClient();
  const navigate = useNavigate();
  const saved = useRef(false);
  const blocker = useBlocker(() => isDirty && !saved.current);
  useBeforeUnload((event) => {
    if (isDirty && !saved.current) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  const mutation = useMutation({
    mutationFn: async (values: TranslationFields) => {
      const { locale, ...fields } = values;
      const input = {
        ...fields,
        title: fields.title.trim(),
        seoTitle: fields.seoTitle || null,
        seoDescription: fields.seoDescription || null,
      };
      if (!post) {
        await createPost({
          ...input,
          locale,
          ...normalizeSettings(settings.getValues()),
        });
        return { kind: "created" } as const;
      }
      if (creating) {
        await createTranslation(post.contentId, locale, input);
        return { kind: "created" } as const;
      }
      if (revision.current === undefined)
        throw new Error("缺少文章版本号，请重新读取。");
      const result = await saveTranslation(
        post.contentId,
        locale,
        revision.current,
        input,
      );
      return { kind: "updated", revision: result.revision } as const;
    },
    onSuccess: (result, values) => {
      toast.success(creating ? "文章版本已发布" : "文章版本已更新");
      void cache.invalidateQueries({ queryKey: postsKey });
      void cache.invalidateQueries({ queryKey: topicsKey });
      if (result.kind === "updated") {
        revision.current = result.revision;
        reset(values);
      } else {
        saved.current = true;
        void cache.invalidateQueries({ queryKey: taxonomyKey("categories") });
        void cache.invalidateQueries({ queryKey: taxonomyKey("tags") });
        void navigate("/posts");
      }
    },
  });
  const settingsMutation = useMutation({
    mutationFn: (values: PostSettings) => {
      if (!post || creating) throw new Error("文章尚未创建。");
      const clean = normalizeSettings(values);
      return savePostSettings(post.contentId, {
        categoryId: dirtyFields.categoryId ? clean.categoryId : undefined,
        coverImage: dirtyFields.coverImage ? clean.coverImage : undefined,
        tagIds: dirtyFields.tagIds ? clean.tagIds : undefined,
        topicIds: dirtyFields.topicIds ? clean.topicIds : undefined,
      });
    },
    onSuccess: (_, values) => {
      settings.reset(values);
      toast.success("文章设置已保存");
      void cache.invalidateQueries({ queryKey: postsKey });
      void cache.invalidateQueries({ queryKey: topicsKey });
      void cache.invalidateQueries({ queryKey: taxonomyKey("categories") });
      void cache.invalidateQueries({ queryKey: taxonomyKey("tags") });
    },
  });
  const reload = useMutation({
    mutationFn: () => {
      if (!post || creating) throw new Error("缺少可重新读取的文章版本。");
      return reloadTranslation(post.contentId, post.locale);
    },
    onSuccess: (latest) => {
      revision.current = latest.revision;
      reset(languageDefaults(latest));
      mutation.reset();
    },
  });

  const hasConflict =
    mutation.error instanceof AdminRequestError &&
    mutation.error.code === "REVISION_CONFLICT";
  const activeLocale = creating ? (post ? other : undefined) : post?.locale;
  const seoTitleValue = watch("seoTitle") ?? "";
  const seoDescValue = watch("seoDescription") ?? "";

  return (
    <div className="max-w-7xl space-y-5">
      <PageHeader
        title={creating ? (post ? "添加语言版本" : "新建文章") : "编辑文章"}
        description="中英文版本独立保存并实时发布；分类、标签、专题和共享封面在右侧单独保存。"
        actions={
          <Link className={buttonVariants({ variant: "outline" })} to="/posts">
            返回文章管理
          </Link>
        }
      />
      {hasNoLocale ? (
        <ErrorState message="这篇文章已包含中英文版本。" />
      ) : (
        <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <form
            noValidate
            onSubmit={handleSubmit((values) => {
              if (!post)
                void settings.handleSubmit(() => mutation.mutate(values))();
              else mutation.mutate(values);
            })}
            className="min-w-0 rounded-panel border border-border bg-card p-5 shadow-[0_1px_3px_rgba(24,24,27,0.04)] sm:p-6"
          >
            <fieldset
              disabled={mutation.isPending || reload.isPending}
              className="space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                {creating && !post ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold text-foreground">
                      发布语言
                    </span>
                    <Controller
                      control={control}
                      name="locale"
                      render={({ field }) => (
                        <div
                          role="group"
                          aria-label="选择发布语言"
                          className="inline-flex rounded-control border border-border bg-background p-1"
                        >
                          {locales.map((item) => {
                            const selected = field.value === item;
                            return (
                              <button
                                key={item}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => field.onChange(item)}
                                className={cn(
                                  "cursor-pointer rounded-[6px] px-3 py-1.5 text-xs font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                  selected
                                    ? "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(24,24,27,0.06)]"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {localeMeta[item]}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    />
                  </div>
                ) : post && !creating ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      当前编辑语言
                    </span>
                    <div
                      role="group"
                      aria-label="双语版本切换"
                      className="inline-flex flex-wrap items-center gap-1 rounded-control border border-border bg-background p-1"
                    >
                      {locales.map((item) => {
                        const isCurrent = item === post.locale;
                        if (isCurrent) {
                          return (
                            <span
                              key={item}
                              aria-current="true"
                              className="inline-flex items-center gap-2 rounded-[6px] bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-[0_1px_2px_rgba(24,24,27,0.06)]"
                            >
                              <span>{localeMeta[item]}</span>
                              <LocaleBadge
                                locale={item}
                                exists
                                variant="compact"
                              />
                            </span>
                          );
                        }
                        return (
                          <Link
                            key={item}
                            to={
                              alternative
                                ? `/posts/${encodeURIComponent(alternative.id)}/edit`
                                : `/posts/new?from=${encodeURIComponent(post.id)}`
                            }
                            className="inline-flex items-center gap-2 rounded-[6px] px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-card/70 hover:text-foreground"
                          >
                            <span>{localeMeta[item]}</span>
                            <LocaleBadge
                              locale={item}
                              exists={Boolean(alternative)}
                              variant="compact"
                            />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      正在新增语言版本
                    </span>
                    {activeLocale && (
                      <LocaleBadge
                        locale={activeLocale}
                        exists={false}
                        variant="default"
                      />
                    )}
                    {post && (
                      <Link
                        to={`/posts/${encodeURIComponent(post.id)}/edit`}
                        className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        回到{post.locale === "zh" ? "中文" : "英文"}版
                      </Link>
                    )}
                  </div>
                )}
              </div>

              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                <span>标题</span>
                <Input
                  maxLength={200}
                  placeholder="输入文章标题…"
                  aria-invalid={!!errors.title}
                  required
                  {...register("title", {
                    validate: (value) => !!value.trim() || "请输入标题。",
                  })}
                />
                {errors.title && (
                  <span role="alert" className="text-xs text-destructive">
                    {errors.title.message}
                  </span>
                )}
              </label>

              <div className="grid gap-1.5">
                <label
                  htmlFor="post-slug"
                  className="text-sm font-medium text-foreground"
                >
                  Slug
                </label>
                <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                  <Input
                    id="post-slug"
                    maxLength={120}
                    className="font-mono text-xs sm:text-sm"
                    placeholder="astro-cloudflare-workers-guide"
                    aria-invalid={!!errors.slug}
                    required
                    {...register("slug", {
                      validate: (value) =>
                        slugPattern.test(value) ||
                        "请输入由小写英文字母、数字和连字符组成的 Slug。",
                    })}
                  />
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => {
                      const title = getValues("title").trim();
                      if (!title || /[^\u0020-\u007e]/.test(title)) {
                        toast.info("无法从此标题生成英文 Slug，请手动输入。");
                        return;
                      }
                      setValue(
                        "slug",
                        title
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .slice(0, 120)
                          .replace(/^-|-$/g, ""),
                        { shouldDirty: true, shouldValidate: true },
                      );
                    }}
                  >
                    <Sparkles size={14} aria-hidden="true" />
                    从标题生成
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Slug 在同一语言内必须唯一。修改已发布文章的 Slug
                  后，旧地址会自动重定向到新地址。
                </p>
                {errors.slug && (
                  <span role="alert" className="text-xs text-destructive">
                    {errors.slug.message}
                  </span>
                )}
              </div>

              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                <span>摘要</span>
                <Textarea
                  rows={3}
                  maxLength={500}
                  placeholder="简要概括文章核心内容，用于列表卡片与默认元描述…"
                  {...register("summary")}
                />
              </label>

              <Controller
                control={control}
                name="content"
                rules={{
                  validate: (value) => !!value.trim() || "请输入正文。",
                }}
                render={({ field, fieldState }) => (
                  <MarkdownEditor
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />

              <details className="group overflow-hidden rounded-panel border border-border bg-background/50">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground select-none hover:bg-accent/50">
                  <span>搜索引擎优化（SEO）· 当前语言</span>
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className="text-muted-foreground transition-transform duration-150 group-open:rotate-180"
                  />
                </summary>
                <div className="space-y-4 border-t border-border bg-card p-4">
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="post-seo-title"
                        className="text-sm font-medium text-foreground"
                      >
                        SEO 标题
                      </label>
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {seoTitleValue.length} / 200
                      </span>
                    </div>
                    <Input
                      id="post-seo-title"
                      maxLength={200}
                      placeholder="留空时自动沿用文章标题"
                      {...register("seoTitle")}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="post-seo-desc"
                        className="text-sm font-medium text-foreground"
                      >
                        SEO 描述
                      </label>
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {seoDescValue.length} / 500
                      </span>
                    </div>
                    <Textarea
                      id="post-seo-desc"
                      rows={2}
                      maxLength={500}
                      placeholder="留空时优先回退文章摘要，再回退站点默认 SEO 描述"
                      {...register("seoDescription")}
                    />
                  </div>
                </div>
              </details>

              {mutation.isError && (
                <ErrorState message={mutation.error.message} />
              )}
              {reload.isError && <ErrorState message={reload.error.message} />}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button type="submit" disabled={hasConflict}>
                    {mutation.isPending
                      ? "正在保存…"
                      : creating
                        ? "保存并发布"
                        : "保存当前语言"}
                  </Button>
                  {hasConflict && !creating && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => reload.mutate()}
                    >
                      放弃当前语言草稿并重新读取
                    </Button>
                  )}
                </div>
                {languageDirty && !hasConflict && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-border bg-warning-surface px-2.5 py-0.5 text-xs font-medium text-warning">
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full bg-warning"
                    />
                    当前语言有未保存的修改
                  </span>
                )}
              </div>
            </fieldset>
          </form>
          {(!creating || !post) && (
            <PostSettingsForm
              settings={settings}
              categories={categories}
              tags={tags}
              topics={topics}
              onSave={
                creating
                  ? undefined
                  : (values) => settingsMutation.mutate(values)
              }
              pending={
                settingsMutation.isPending || (creating && mutation.isPending)
              }
              usesLegacyCover={!creating && post?.usesLegacyCover === true}
              error={settingsMutation.error?.message}
            />
          )}
        </div>
      )}
      {blocker.state === "blocked" && (
        <ConfirmDialog
          title="放弃未保存的修改？"
          description="离开后，这次尚未保存的修改会丢失。"
          confirmLabel="放弃并离开"
          open
          onOpenChange={(open) => {
            if (!open) blocker.reset();
          }}
          onConfirm={() => blocker.proceed()}
        />
      )}
    </div>
  );
}
