import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { PageHeader } from "../components/admin/page-header";
import { ErrorState, LoadingState } from "../components/admin/states";
import { Button, buttonVariants } from "../components/ui/button";
import { Input } from "../components/ui/input";
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

const languages = { zh: "中文", en: "English" } as const;
const locales = ["zh", "en"] as const;
type Locale = TopicInput["locale"];
type Translation = TopicDetail["translations"][number];
const textarea =
  "w-full rounded-lg border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const panel = "min-w-0 space-y-4 rounded-lg border border-border p-4 sm:p-5";

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
  return (
    <form
      aria-labelledby={heading}
      className={panel}
      onSubmit={handleSubmit((values) => save.mutate(values))}
    >
      <div>
        <h2 id={heading} className="text-lg font-semibold">
          {languages[locale]}专题信息
        </h2>
        <p className="text-muted-foreground">
          保存即发布当前语言，不修改其他语言或文章关系。
        </p>
      </div>
      <fieldset disabled={save.isPending} className="grid gap-4 sm:grid-cols-2">
        <label className="block min-w-0 space-y-1.5">
          <span>专题名称</span>
          <Input
            required
            maxLength={200}
            {...register("title", {
              validate: (value) => !!value.trim() || "请输入专题名称。",
            })}
          />
          {errors.title && (
            <span role="alert" className="text-destructive">
              {errors.title.message}
            </span>
          )}
        </label>
        <label className="block min-w-0 space-y-1.5">
          <span>Slug</span>
          <Input
            required
            maxLength={120}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            {...register("slug")}
          />
          <small className="block text-muted-foreground">
            /{locale}/topics/ · 使用小写字母、数字和连字符。
          </small>
        </label>
        <label className="block min-w-0 space-y-1.5 sm:col-span-2">
          <span>专题描述</span>
          <textarea
            maxLength={2000}
            rows={3}
            className={textarea}
            {...register("description")}
          />
        </label>
        <details className="min-w-0 space-y-3 rounded-md border border-border p-3 sm:col-span-2">
          <summary className="cursor-pointer font-medium">
            当前语言的 SEO 设置
          </summary>
          <label className="block space-y-1.5">
            <span>SEO 标题</span>
            <Input maxLength={160} {...register("seoTitle")} />
          </label>
          <label className="block space-y-1.5">
            <span>SEO 描述</span>
            <textarea
              maxLength={320}
              rows={2}
              className={textarea}
              {...register("seoDescription")}
            />
          </label>
        </details>
      </fieldset>
      {save.error && <ErrorState message={save.error.message} />}
      <Button disabled={!isDirty || save.isPending}>
        {save.isPending ? "正在保存…" : topicId ? "保存当前语言" : "创建专题"}
      </Button>
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
    register,
    handleSubmit,
    reset,
    formState: { dirtyFields, isDirty },
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
      className={panel}
      aria-labelledby="topic-settings"
      onSubmit={handleSubmit((values) => save.mutate(values))}
    >
      <div>
        <h2 className="text-lg font-semibold" id="topic-settings">
          全语言共享设置
        </h2>
        <p className="text-muted-foreground">封面和展示顺序对所有语言生效。</p>
      </div>
      <fieldset className="grid gap-4 sm:grid-cols-2" disabled={save.isPending}>
        <label className="block min-w-0 space-y-1.5">
          <span>专题封面 URL</span>
          <Input type="url" maxLength={2048} {...register("coverImage")} />
        </label>
        <label className="block min-w-0 space-y-1.5">
          <span>专题展示顺序</span>
          <Input
            required
            type="number"
            step={1}
            min={-2147483648}
            max={2147483647}
            {...register("sortOrder", { valueAsNumber: true })}
          />
          <small className="block text-muted-foreground">
            数值越小，专题越靠前。
          </small>
        </label>
      </fieldset>
      {save.error && <ErrorState message={save.error.message} />}
      <Button variant="outline" disabled={!isDirty || save.isPending}>
        保存共享设置
      </Button>
    </form>
  );
}

function TopicForms({ topic }: { topic?: TopicDetail }) {
  const [locale, setLocale] = useState<Locale>(topic?.locales[0] ?? "zh");
  return (
    <div className="space-y-5">
      <div aria-label="专题语言" role="group" className="flex flex-wrap gap-2">
        {locales.map((item) => (
          <Button
            type="button"
            key={item}
            aria-pressed={locale === item}
            variant={locale === item ? "default" : "ghost"}
            onClick={() => setLocale(item)}
          >
            {languages[item]} · {item.toUpperCase()}
            {topic && (
              <span className="text-xs text-muted-foreground">
                {topic.locales.includes(item) ? "已发布" : "未创建"}
              </span>
            )}
          </Button>
        ))}
      </div>
      {topic?.legacy && !topic.locales.includes(locale) && (
        <p className="rounded-lg border border-border p-3 text-muted-foreground">
          旧专题「{topic.legacy.title}
          」仍可从原地址访问；旧文案不是当前语言的译文。
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
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={id ? "编辑专题" : "新建专题"}
        description="分别管理中文与英文专题；封面、文章关联和顺序对所有语言共享。"
        actions={
          <Link to="/topics" className={buttonVariants({ variant: "outline" })}>
            返回专题管理
          </Link>
        }
      />
      {id && topic.isPending ? (
        <LoadingState />
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
