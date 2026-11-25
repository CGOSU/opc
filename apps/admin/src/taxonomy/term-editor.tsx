import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useId, useState, type RefObject } from "react";
import { useForm } from "react-hook-form";
import { LocaleBadge } from "../components/admin/locale-badge";
import { ErrorState } from "../components/admin/states";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { cn } from "../lib/utils";
import {
  saveTermSettings,
  type Locale,
  type TaxonomyKind,
  type Term,
} from "./api";
import { TermLanguageForm } from "./term-language-form";

const languages = [
  { locale: "zh", label: "中文 · ZH" },
  { locale: "en", label: "English · EN" },
] as const;

export function TermEditor({
  kind,
  label,
  term,
  returnFocus,
  onClose,
  onSaved,
}: {
  kind: TaxonomyKind;
  label: string;
  term: Term | null;
  returnFocus: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [locale, setLocale] = useState<Locale>(
    term?.translations[0]?.locale ?? "zh",
  );
  const [versions, setVersions] = useState(
    term?.translations.map(({ locale }) => locale) ?? [],
  );
  const [pending, setPending] = useState(0);
  const busy = pending > 0;
  function onBusy(isBusy: boolean) {
    setPending((count) => count + (isBusy ? 1 : -1));
  }

  return (
    <Dialog
      open
      disablePointerDismissal
      onOpenChange={(open, details) => {
        if (open) return;
        if (busy) details.cancel();
        else onClose();
      }}
    >
      <DialogContent
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-border bg-card shadow-2xl outline-none"
        finalFocus={returnFocus}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border bg-background/60 px-6 py-4">
          <div className="min-w-0">
            <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
              {term ? "编辑" : "新建"}
              {label}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {term
                ? `当前实体：${term.name}`
                : "先保存一个语言版本，随后可继续完善另一语言与 SEO。"}
            </DialogDescription>
          </div>
          <DialogClose
            disabled={busy}
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="关闭抽屉"
              />
            }
          >
            <X size={18} aria-hidden="true" />
          </DialogClose>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {term?.legacy && (
            <aside className="space-y-1.5 rounded-panel border border-border bg-background/80 p-4 text-xs">
              <p className="font-semibold text-foreground">
                历史内容 · 未标记语言
              </p>
              <p className="font-mono wrap-anywhere text-foreground">
                {term.legacy.name} · {term.legacy.slug}
              </p>
              {term.legacy.description && (
                <p className="wrap-anywhere text-muted-foreground">
                  {term.legacy.description}
                </p>
              )}
              <p className="text-muted-foreground">
                旧地址仍可访问；历史内容不计作中文或英文版本。
              </p>
            </aside>
          )}

          <div
            role="group"
            aria-label="编辑语言"
            className="grid grid-cols-2 gap-1 rounded-control border border-border bg-background p-1"
          >
            {languages.map((language) => {
              const active = locale === language.locale;
              const exists = versions.includes(language.locale);
              return (
                <button
                  key={language.locale}
                  type="button"
                  aria-pressed={active}
                  disabled={busy}
                  onClick={() => setLocale(language.locale)}
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-2 rounded-[6px] px-3 py-2 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                    active
                      ? "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(24,24,27,0.06)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>{language.label}</span>
                  {term && (
                    <LocaleBadge
                      locale={language.locale}
                      exists={exists}
                      variant="compact"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {languages.map((language) => (
            <div key={language.locale} hidden={locale !== language.locale}>
              <TermLanguageForm
                kind={kind}
                label={label}
                term={term}
                locale={language.locale}
                onBusy={onBusy}
                onSaved={async () => {
                  setVersions((current) =>
                    current.includes(language.locale)
                      ? current
                      : [...current, language.locale],
                  );
                  if (!term) onClose();
                  await onSaved();
                }}
              />
            </div>
          ))}

          {term && (
            <TermSettings
              kind={kind}
              term={term}
              onSaved={onSaved}
              onBusy={onBusy}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TermSettings({
  kind,
  term,
  onSaved,
  onBusy,
}: {
  kind: TaxonomyKind;
  term: Term;
  onSaved: () => Promise<void>;
  onBusy: (value: boolean) => void;
}) {
  const id = useId();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<{ sortOrder: number }>({
    defaultValues: { sortOrder: term.sortOrder },
  });
  const save = useMutation({
    mutationFn: ({ sortOrder }: { sortOrder: number }) =>
      saveTermSettings(kind, term.id, sortOrder),
    onMutate: () => {
      onBusy(true);
    },
    onSuccess: async (_, values) => {
      reset(values);
      await onSaved();
    },
    onSettled: () => {
      onBusy(false);
    },
  });
  return (
    <form
      className="space-y-3 border-t border-border pt-5"
      noValidate
      onSubmit={handleSubmit((values) => save.mutate(values))}
    >
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          共享属性与关联
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          已关联{" "}
          <span className="font-mono font-medium text-foreground">
            {term.articleCount}
          </span>{" "}
          篇文章。
          {kind === "categories"
            ? "有文章引用时不可删除。"
            : "删除标签仅解除关联，不会删除文章。"}
        </p>
      </div>
      <fieldset disabled={save.isPending} className="space-y-2.5">
        <div className="space-y-1.5">
          <label htmlFor={id} className="block text-sm font-medium">
            排序值
          </label>
          <Input
            id={id}
            className="max-w-36 font-mono"
            type="number"
            step="1"
            aria-invalid={!!errors.sortOrder}
            aria-describedby={id + "-help"}
            {...register("sortOrder", {
              valueAsNumber: true,
              validate: (value) =>
                (Number.isInteger(value) &&
                  value >= -2147483648 &&
                  value <= 2147483647) ||
                "请输入有效整数。",
            })}
          />
          <p
            id={id + "-help"}
            className={
              errors.sortOrder
                ? "text-xs text-destructive"
                : "text-xs text-muted-foreground"
            }
          >
            {errors.sortOrder?.message ?? "数值越小，排列越靠前。"}
          </p>
        </div>
        {save.error && <ErrorState message={save.error.message} />}
        <Button
          type="submit"
          variant="outline"
          disabled={!isDirty || save.isPending}
        >
          {save.isPending ? "正在保存…" : "保存共享设置"}
        </Button>
      </fieldset>
    </form>
  );
}
