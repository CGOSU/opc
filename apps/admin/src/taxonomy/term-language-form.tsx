import { useMutation } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { ErrorState } from "../components/admin/states";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  loadTerm,
  saveTerm,
  saveTermTranslation,
  type Locale,
  type TaxonomyKind,
  type Term,
} from "./api";

type Values = {
  name: string;
  slug: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
};
type Version = Term["translations"][number];

function toFields(row?: Version): Values {
  return {
    name: row?.name ?? "",
    slug: row?.slug ?? "",
    description: row?.description ?? "",
    seoTitle: row?.seoTitle ?? "",
    seoDescription: row?.seoDescription ?? "",
  };
}

export function TermLanguageForm({
  kind,
  label,
  term,
  locale,
  onSaved,
  onBusy,
}: {
  kind: TaxonomyKind;
  label: string;
  term: Term | null;
  locale: Locale;
  onSaved: () => Promise<void>;
  onBusy: (value: boolean) => void;
}) {
  const id = useId();
  const version = term?.translations.find((item) => item.locale === locale);
  const [revision, setRevision] = useState(version?.revision);
  const [confirmReload, setConfirmReload] = useState(false);
  const {
    register,
    watch,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<Values>({
    defaultValues: toFields(version),
  });
  const save = useMutation({
    mutationFn: (values: Values) => {
      const input = {
        ...values,
        seoTitle: values.seoTitle.trim() || null,
        seoDescription: values.seoDescription.trim() || null,
      };
      return term
        ? saveTermTranslation(kind, term.id, locale, input, revision)
        : saveTerm(kind, { ...input, locale });
    },
    onMutate: () => {
      onBusy(true);
      setConfirmReload(false);
    },
    onSuccess: async (_, values) => {
      reset(values);
      setRevision((current) => (current ?? 0) + 1);
      await onSaved();
    },
    onSettled: () => {
      onBusy(false);
    },
  });
  const reload = useMutation({
    mutationFn: async (termId: string) => {
      const server = await loadTerm(kind, termId);
      const latest = server.translations.find((row) => row.locale === locale);
      if (!latest) throw new Error("服务器还没有此语言版本，草稿未被替换。");
      return latest;
    },
    onMutate: () => {
      onBusy(true);
    },
    onSuccess: async (latest) => {
      reset(toFields(latest));
      setRevision(latest.revision);
      save.reset();
      setConfirmReload(false);
      await onSaved();
    },
    onSettled: () => {
      onBusy(false);
    },
  });
  const pending = save.isPending || reload.isPending;
  const seoTitleValue = watch("seoTitle") ?? "";
  const seoDescValue = watch("seoDescription") ?? "";

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => save.mutate(values))}
      aria-busy={pending}
    >
      <fieldset className="space-y-4" disabled={pending}>
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-control border border-border bg-background/70 px-3 py-2 text-xs text-muted-foreground"
        >
          <span>
            {revision === undefined
              ? "尚未创建此语言版本；保存后将生成公开地址。"
              : `当前语言已发布`}
          </span>
          {revision !== undefined && (
            <span className="font-mono text-[11px] font-medium text-foreground">
              revision {revision}
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor={id + "-name"}
            className="block text-sm font-medium text-foreground"
          >
            {label}名称（必填）
          </label>
          <Input
            id={id + "-name"}
            required
            maxLength={100}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? id + "-name-error" : undefined}
            {...register("name", {
              required: "请输入名称。",
              setValueAs: (value: string) => value.trim(),
            })}
          />
          {errors.name && (
            <p id={id + "-name-error"} className="text-xs text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor={id + "-slug"}
            className="block text-sm font-medium text-foreground"
          >
            Slug（必填）
          </label>
          <Input
            id={id + "-slug"}
            required
            maxLength={120}
            autoCapitalize="none"
            spellCheck={false}
            className="font-mono text-xs sm:text-sm"
            aria-invalid={!!errors.slug}
            aria-describedby={id + "-slug-help"}
            {...register("slug", {
              required: "请输入 Slug。",
              pattern: {
                value: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                message: "仅用小写字母、数字和分隔用的连字符。",
              },
            })}
          />
          <p
            id={id + "-slug-help"}
            className={
              errors.slug
                ? "text-xs text-destructive"
                : "text-xs text-muted-foreground"
            }
          >
            {errors.slug?.message ?? `/${locale}/${kind}/… · 同一语言内唯一`}
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor={id + "-description"}
            className="block text-sm font-medium text-foreground"
          >
            描述
          </label>
          <Textarea
            id={id + "-description"}
            rows={3}
            maxLength={500}
            placeholder="用于在列表页展示的简介说明…"
            {...register("description")}
          />
        </div>

        <details className="group overflow-hidden rounded-panel border border-border bg-background/50">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground select-none hover:bg-accent/50">
            <span>当前语言 SEO 设置</span>
            <ChevronDown
              size={15}
              aria-hidden="true"
              className="text-muted-foreground transition-transform duration-150 group-open:rotate-180"
            />
          </summary>
          <div className="space-y-3.5 border-t border-border bg-card p-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor={id + "-seo-title"}
                  className="text-sm font-medium text-foreground"
                >
                  SEO 标题
                </label>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {seoTitleValue.length} / 160
                </span>
              </div>
              <Input
                id={id + "-seo-title"}
                maxLength={160}
                placeholder="留空时自动使用名称"
                {...register("seoTitle")}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor={id + "-seo-desc"}
                  className="text-sm font-medium text-foreground"
                >
                  SEO 描述
                </label>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {seoDescValue.length} / 320
                </span>
              </div>
              <Textarea
                id={id + "-seo-desc"}
                rows={2}
                maxLength={320}
                placeholder="留空时回退至描述或站点默认 SEO 描述"
                {...register("seoDescription")}
              />
            </div>
          </div>
        </details>

        {save.error && <ErrorState message={save.error.message} />}
        {reload.error && <ErrorState message={reload.error.message} />}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending || (!!revision && !isDirty)}>
            {save.isPending ? "正在保存…" : "保存当前语言"}
          </Button>
          {term && save.error && !confirmReload && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmReload(true)}
            >
              重新载入服务器版本
            </Button>
          )}
        </div>

        {term && confirmReload && (
          <div className="space-y-2.5 rounded-panel border border-warning-border bg-warning-surface/60 p-3.5 text-xs">
            <p className="font-medium text-warning">
              如果服务器已有此语言版本，重新载入会替换当前语言的草稿。
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => reload.mutate(term.id)}
              >
                确认重新载入
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmReload(false)}
              >
                保留草稿
              </Button>
            </div>
          </div>
        )}
      </fieldset>
    </form>
  );
}
