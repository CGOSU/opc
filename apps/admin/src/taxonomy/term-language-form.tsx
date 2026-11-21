import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { ErrorState } from "../components/admin/states";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
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
  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => save.mutate(values))}
      aria-busy={pending}
    >
      <fieldset className="space-y-4" disabled={pending}>
        <p className="text-muted-foreground" role="status">
          {revision === undefined
            ? "尚未创建；保存后才会生成该译文的地址。"
            : `已保存 · revision ${revision}`}
        </p>
        <div className="space-y-1.5">
          <label htmlFor={id + "-name"} className="font-medium">
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
            <p id={id + "-name-error"} className="text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor={id + "-slug"} className="font-medium">
            Slug（必填）
          </label>
          <Input
            id={id + "-slug"}
            required
            maxLength={120}
            autoCapitalize="none"
            spellCheck={false}
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
              errors.slug ? "text-destructive" : "text-muted-foreground"
            }
          >
            {errors.slug?.message ?? `/${locale}/${kind}/… · 同一语言内唯一`}
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={id + "-description"} className="font-medium">
            描述
          </label>
          <textarea
            id={id + "-description"}
            rows={3}
            maxLength={500}
            className="block w-full resize-y rounded-control border border-input bg-card px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...register("description")}
          />
        </div>
        <details className="rounded-panel border border-border p-3">
          <summary className="cursor-pointer font-medium">
            当前语言 SEO 设置
          </summary>
          <div className="mt-3 space-y-3">
            <label className="block space-y-1.5">
              <span>SEO 标题</span>
              <Input maxLength={160} {...register("seoTitle")} />
            </label>
            <label className="block space-y-1.5">
              <span>SEO 描述</span>
              <Input maxLength={320} {...register("seoDescription")} />
            </label>
          </div>
        </details>
        {save.error && <ErrorState message={save.error.message} />}
        {reload.error && <ErrorState message={reload.error.message} />}
        <div className="flex flex-wrap gap-2">
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
          <div className="space-y-2 rounded-panel border border-border p-3">
            <p>如果服务器已有此语言版本，重新载入会替换当前语言的草稿。</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => reload.mutate(term.id)}
              >
                确认重新载入
              </Button>
              <Button
                type="button"
                variant="ghost"
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
