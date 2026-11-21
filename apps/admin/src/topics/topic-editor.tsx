import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { CoverImageField } from "../components/admin/cover-image-field";
import { LocaleBadge } from "../components/admin/locale-badge";
import { PageHeader } from "../components/admin/page-header";
import { ErrorState, LoadingState } from "../components/admin/states";
import { Button, buttonVariants } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { cn } from "../lib/utils";
import { postsKey } from "../posts/api";
import {
  createTopic,
  saveTopicSettings,
  saveTopicTranslation,
  topicDetail,
  topicsKey,
  type TopicDetail,
  type TopicInput,
} from "./api";
import { TopicArticles } from "./topic-articles";

const languages = { zh: "中文 · ZH", en: "English · EN" } as const;
const locales = ["zh", "en"] as const;
type Locale = TopicInput["locale"];
type Translation = TopicDetail["translations"][number];
const panel =
  "min-w-0 space-y-5 rounded-panel border border-border bg-card p-5 shadow-[0_1px_3px_rgba(24,24,27,0.04)] sm:p-6";

function useRefreshTopics() {
  const cache = useQueryClient();
  return () =>
    Promise.all([
      cache.invalidateQueries({ queryKey: topicsKey }),
      cache.invalidateQueries({ queryKey: postsKey }),
    ]);
}

function TranslationForm({
  topicId,
  locale,
  translation,
}: {
  topicId?: string;
  locale: Locale;
  translation?: Translation;
}) {
  const refresh = useRefreshTopics();
  const navigate = useNavigate();
  const heading = useId();
  const {
    register,
    watch,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    defaultValues: {
      title: translation?.title ?? "",
      slug: translation?.slug ?? "",
      description: translation?.description ?? "",
      seoTitle: translation?.seoTitle ?? "",
      seoDescription: translation?.seoDescription ?? "",
    },
  });
  const save = useMutation({
    mutationFn: (values: ReturnType<typeof formValues>) =>
      topicId
        ? saveTopicTranslation(
            topicId,
            locale,
            formValues(values),
            !!translation,
          )
        : createTopic({ locale, ...formValues(values) }),
    onSuccess: async ({ id }, values) => {
      await refresh();
      reset(values);
      toast.success(topicId ? "当前语言已保存" : "专题已创建");
      if (!topicId) void navigate(`/topics/${id}`, { replace: true });
    },
  });

  const seoTitleValue = watch("seoTitle") ?? "";
  const seoDescValue = watch("seoDescription") ?? "";

  return (
    <form
      aria-labelledby={heading}
      className={panel}
      onSubmit={handleSubmit((values) => save.mutate(values))}
    >
      <div className="border-b border-border pb-4">
        <h2 id={heading} className="text-base font-semibold text-foreground">
          {languages[locale]} 专题信息
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
          保存即发布当前语言，不修改其他语言或已关联文章的顺序。
        </p>
      </div>
      <fieldset disabled={save.isPending} className="grid gap-4 sm:grid-cols-2">
        <label className="block min-w-0 space-y-1.5 text-sm font-medium text-foreground">
          <span>专题名称</span>
          <Input
            required
            maxLength={200}
            {...register("title", {
              validate: (value) => !!value.trim() || "请输入专题名称。",
            })}
          />
          {errors.title && (
            <span role="alert" className="block text-xs text-destructive">
              {errors.title.message}
            </span>
          )}
        </label>
        <label className="block min-w-0 space-y-1.5 text-sm font-medium text-foreground">
          <span>Slug</span>
          <Input
            required
            maxLength={120}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            className="font-mono text-xs sm:text-sm"
            {...register("slug")}
          />
          <small className="block text-xs font-normal text-muted-foreground">
            /{locale}/topics/ · 使用小写字母、数字和连字符。
          </small>
        </label>
        <label className="block min-w-0 space-y-1.5 text-sm font-medium text-foreground sm:col-span-2">
          <span>专题描述</span>
          <Textarea
            maxLength={2000}
            rows={3}
            placeholder="介绍专题涵盖的技术方向、适用读者或推荐阅读顺序…"
            {...register("description")}
          />
        </label>
        <details className="group min-w-0 overflow-hidden rounded-panel border border-border bg-background/50 sm:col-span-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground select-none hover:bg-accent/50">
            <span>当前语言的 SEO 设置</span>
            <ChevronDown
              size={15}
              aria-hidden="true"
              className="text-muted-foreground transition-transform duration-150 group-open:rotate-180"
            />
          </summary>
          <div className="space-y-3.5 border-t border-border bg-card p-4">
            <label className="block space-y-1.5">
              <span className="flex items-center justify-between gap-2 text-sm font-medium text-foreground">
                <span>SEO 标题</span>
                <span className="font-mono text-[11px] font-normal tabular-nums text-muted-foreground">
                  {seoTitleValue.length} / 160
                </span>
              </span>
              <Input
                maxLength={160}
                placeholder="留空时自动沿用专题名称"
                {...register("seoTitle")}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="flex items-center justify-between gap-2 text-sm font-medium text-foreground">
                <span>SEO 描述</span>
                <span className="font-mono text-[11px] font-normal tabular-nums text-muted-foreground">
                  {seoDescValue.length} / 320
                </span>
              </span>
              <Textarea
                maxLength={320}
                rows={2}
                placeholder="留空时回退至专题描述或站点默认 SEO 描述"
                {...register("seoDescription")}
              />
            </label>
          </div>
        </details>
      </fieldset>
      {save.error && <ErrorState message={save.error.message} />}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Button disabled={!isDirty || save.isPending}>
          {save.isPending ? "正在保存…" : topicId ? "保存当前语言" : "创建专题"}
        </Button>
        {isDirty && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-border bg-warning-surface px-2.5 py-0.5 text-xs font-medium text-warning">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-warning"
            />
            当前语言有未保存的修改
          </span>
        )}
      </div>
    </form>
  );
}

function formValues(values: {
  title: string;
  slug: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
}) {
  return { ...values, title: values.title.trim() };
}

function SharedSettings({ topic }: { topic: TopicDetail }) {
  const refresh = useRefreshTopics();
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { dirtyFields, isDirty, errors },
  } = useForm({
    defaultValues: {
      coverImage: topic.coverImage ?? "",
      sortOrder: topic.sortOrder,
    },
  });
  const save = useMutation({
    mutationFn: (values: { coverImage: string; sortOrder: number }) =>
      saveTopicSettings(topic.id, {
        ...(dirtyFields.coverImage
          ? { coverImage: values.coverImage.trim() || null }
          : {}),
        ...(dirtyFields.sortOrder ? { sortOrder: values.sortOrder } : {}),
      }),
    onSuccess: async (_, values) => {
      await refresh();
      reset({ ...values, coverImage: values.coverImage.trim() });
      toast.success("共享设置已保存");
    },
  });

  return (
    <form
      noValidate
      className={panel}
      aria-labelledby="topic-settings"
      onSubmit={handleSubmit((values) => save.mutate(values))}
    >
      <div className="border-b border-border pb-4">
        <h2
          className="text-base font-semibold text-foreground"
          id="topic-settings"
        >
          全语言共享设置
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
          封面图和展示顺序对中英文专题统一生效。
        </p>
      </div>
      <fieldset
        className="grid items-start gap-5 sm:grid-cols-2"
        disabled={save.isPending}
      >
        <Controller
          control={control}
          name="coverImage"
          rules={{
            validate: (value) =>
              !value?.trim() ||
              /^https?:\/\//.test(URL.parse(value.trim())?.href ?? "") ||
              "请输入有效的 HTTP 或 HTTPS URL。",
          }}
          render={({ field }) => (
            <CoverImageField
              id="topic-cover-image"
              label="专题封面图"
              placeholder="https://example.com/topic-cover.png"
              value={field.value}
              onChange={field.onChange}
              disabled={save.isPending}
              previewAlt="专题封面预览"
              error={errors.coverImage?.message}
            />
          )}
        />
        <label className="block min-w-0 space-y-1.5 text-sm font-medium text-foreground">
          <span>专题展示顺序</span>
          <Input
            required
            type="number"
            step={1}
            min={-2147483648}
            max={2147483647}
            className="font-mono"
            {...register("sortOrder", { valueAsNumber: true })}
          />
          <small className="block text-xs font-normal text-muted-foreground">
            数值越小，专题在前台越靠前展示。
          </small>
        </label>
      </fieldset>
      {save.error && <ErrorState message={save.error.message} />}
      <div className="border-t border-border pt-4">
        <Button variant="outline" disabled={!isDirty || save.isPending}>
          {save.isPending ? "正在保存…" : "保存共享设置"}
        </Button>
      </div>
    </form>
  );
}

function TopicForms({ topic }: { topic?: TopicDetail }) {
  const [locale, setLocale] = useState<Locale>(topic?.locales[0] ?? "zh");
  return (
    <div className="space-y-5">
      <div
        aria-label="专题语言"
        role="group"
        className="inline-flex flex-wrap gap-1 rounded-control border border-border bg-card p-1 shadow-[0_1px_2px_rgba(24,24,27,0.03)]"
      >
        {locales.map((item) => {
          const active = locale === item;
          const exists = topic?.locales.includes(item) ?? false;
          return (
            <button
              type="button"
              key={item}
              aria-pressed={active}
              onClick={() => setLocale(item)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 rounded-[6px] px-3 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-accent font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--color-border)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span>{languages[item]}</span>
              {topic && (
                <LocaleBadge locale={item} exists={exists} variant="compact" />
              )}
            </button>
          );
        })}
      </div>

      {topic?.legacy && !topic.locales.includes(locale) && (
        <p className="rounded-panel border border-border bg-card px-4 py-3 text-xs text-muted-foreground sm:text-sm">
          旧专题「{topic.legacy.title}」仍可从原地址访问；旧文案不作为当前语言的译文。
        </p>
      )}

      {locales.map((item) => (
        <div key={item} hidden={locale !== item}>
          <TranslationForm
            topicId={topic?.id}
            locale={item}
            translation={topic?.translations.find((tr) => tr.locale === item)}
          />
        </div>
      ))}

      {topic && (
        <>
          <SharedSettings topic={topic} />
          <div className={panel}>
            <TopicArticles topic={topic} locale={locale} />
          </div>
        </>
      )}
    </div>
  );
}

export function TopicEditor() {
  const { id } = useParams();
  const topic = useQuery(topicDetail(id));
  return (
    <div className="max-w-5xl space-y-5">
      <PageHeader
        title={id ? "编辑专题" : "新建专题"}
        description="分别维护中文与英文专题信息；封面、文章关联及排序对所有语言共享。"
        actions={
          <Link to="/topics" className={buttonVariants({ variant: "outline" })}>
            返回专题管理
          </Link>
        }
      />
      {id && topic.isPending ? (
        <LoadingState message="正在读取专题详情…" />
      ) : id && topic.isError ? (
        <ErrorState
          message={topic.error.message}
          onRetry={() => void topic.refetch()}
        />
      ) : (
        <TopicForms key={id ?? "new"} topic={topic.data} />
      )}
    </div>
  );
}
