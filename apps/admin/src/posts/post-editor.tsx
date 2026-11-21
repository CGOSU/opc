import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { PageHeader } from "../components/admin/page-header";
import { ErrorState, LoadingState } from "../components/admin/states";
import { Button, buttonVariants } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { AdminRequestError, taxonomyKey, type Term } from "../taxonomy/api";
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
import { topicOptions, topicsKey, type TopicRow } from "../topics/api";
import { MarkdownEditor } from "./markdown-editor";
import { PostSettingsForm } from "./post-settings-form";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const textareaClass = "w-full rounded-control border border-border bg-card p-3";
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

  return (
    <div className="max-w-7xl space-y-5">
      <PageHeader
        title={creating ? (post ? "添加语言版本" : "新建文章") : "编辑文章"}
        description="语言版本独立保存并立即发布；分类、标签、专题和封面另行保存。"
        actions={
          <Link className={buttonVariants({ variant: "outline" })} to="/posts">
            返回文章管理
          </Link>
        }
      />
      {hasNoLocale ? (
        <ErrorState message="这篇文章已包含中英文版本。" />
      ) : (
        <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19.375rem]">
          <form
            noValidate
            onSubmit={handleSubmit((values) => {
              if (!post)
                void settings.handleSubmit(() => mutation.mutate(values))();
              else mutation.mutate(values);
            })}
            className="min-w-0 rounded-panel border border-border bg-card p-4 sm:p-page"
          >
            <fieldset
              disabled={mutation.isPending || reload.isPending}
              className="space-y-5"
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                {creating && !post ? (
                  <label className="grid w-fit gap-2 font-medium">
                    语言
                    <select
                      className="min-h-control rounded-control border border-border bg-card px-3"
                      {...register("locale")}
                    >
                      <option value="zh">中文</option>
                      <option value="en">English</option>
                    </select>
                  </label>
                ) : (
                  <span className="font-medium">
                    语言：
                    {(creating ? other : post?.locale) === "zh"
                      ? "中文"
                      : "English"}
                  </span>
                )}
                {post && !creating && (
                  <Link
                    className={buttonVariants({ variant: "outline" })}
                    to={
                      alternative
                        ? `/posts/${encodeURIComponent(alternative.id)}/edit`
                        : `/posts/new?from=${encodeURIComponent(post.id)}`
                    }
                  >
                    {alternative ? "编辑" : "添加"}
                    {other === "zh" ? "中文" : "英文"}版本
                  </Link>
                )}
              </div>
              <label className="grid gap-2 font-medium">
                标题
                <Input
                  maxLength={200}
                  aria-invalid={!!errors.title}
                  required
                  {...register("title", {
                    validate: (value) => !!value.trim() || "请输入标题。",
                  })}
                />
                {errors.title && (
                  <span role="alert" className="text-destructive">
                    {errors.title.message}
                  </span>
                )}
              </label>
              <div className="grid gap-2">
                <label htmlFor="post-slug" className="font-medium">
                  Slug
                </label>
                <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                  <Input
                    id="post-slug"
                    maxLength={120}
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
                    从标题生成
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Slug 在同一语言内必须唯一。修改已发布文章的 Slug
                  后，旧地址会重定向到新地址。
                </p>
                {errors.slug && (
                  <span role="alert" className="text-destructive">
                    {errors.slug.message}
                  </span>
                )}
              </div>
              <label className="grid gap-2 font-medium">
                摘要
                <textarea
                  rows={3}
                  maxLength={500}
                  className={textareaClass}
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
              <details className="rounded-control border border-border p-4">
                <summary className="cursor-pointer font-medium">
                  搜索引擎优化 · 当前语言
                </summary>
                <div className="mt-4 space-y-4">
                  <label className="grid gap-2 font-medium">
                    SEO 标题
                    <Input maxLength={200} {...register("seoTitle")} />
                  </label>
                  <label className="grid gap-2 font-medium">
                    SEO 描述
                    <textarea
                      rows={2}
                      maxLength={500}
                      className={textareaClass}
                      {...register("seoDescription")}
                    />
                  </label>
                </div>
              </details>
              {mutation.isError && (
                <ErrorState message={mutation.error.message} />
              )}
              {reload.isError && <ErrorState message={reload.error.message} />}
              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
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
                {languageDirty && !hasConflict && (
                  <span className="text-sm text-muted-foreground">
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
