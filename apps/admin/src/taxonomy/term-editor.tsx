import * as Dialog from "@radix-ui/react-dialog";
import { useMutation } from "@tanstack/react-query";
import { useId, useState, type RefObject } from "react";
import { useForm } from "react-hook-form";
import { ErrorState } from "../components/admin/states";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { TermLanguageForm } from "./term-language-form";
import {
  saveTermSettings,
  type Locale,
  type TaxonomyKind,
  type Term,
} from "./api";

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
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-border bg-card shadow-lg outline-none"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <header className="flex items-start justify-between gap-4 border-b border-border p-page">
            <div>
              <Dialog.Title className="text-lg font-semibold">
                {term ? "编辑" : "新建"}
                {label}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-muted-foreground">
                {term ? term.name : "先保存一个语言版本，再添加其他语言。"}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" disabled={busy}>
                关闭
              </Button>
            </Dialog.Close>
          </header>
          <div className="space-y-5 overflow-y-auto p-page">
            {term?.legacy && (
              <aside className="space-y-1 rounded-panel border border-border bg-muted/50 p-4">
                <p className="font-medium">历史内容 · 未标记语言</p>
                <p className="wrap-anywhere">
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
              className="flex flex-wrap gap-2"
            >
              {languages.map((language) => (
                <Button
                  key={language.locale}
                  type="button"
                  variant="outline"
                  className={
                    locale === language.locale
                      ? "bg-muted border-foreground"
                      : undefined
                  }
                  aria-pressed={locale === language.locale}
                  disabled={busy}
                  onClick={() => setLocale(language.locale)}
                >
                  {language.label}
                  {term && (
                    <span className="text-muted-foreground">
                      {versions.includes(language.locale) ? "已创建" : "未创建"}
                    </span>
                  )}
                </Button>
              ))}
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
      <h2 className="font-semibold">共享属性与关联</h2>
      <p className="text-muted-foreground">
        关联 {term.articleCount} 篇文章。
        {kind === "categories"
          ? "有文章引用时不可删除。"
          : "删除标签会解除关联，不会删除文章。"}
      </p>
      <fieldset disabled={save.isPending} className="space-y-2">
        <label htmlFor={id} className="font-medium">
          排序值
        </label>
        <Input
          id={id}
          className="max-w-32"
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
            errors.sortOrder ? "text-destructive" : "text-muted-foreground"
          }
        >
          {errors.sortOrder?.message ?? "数值越小，排列越靠前。"}
        </p>
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
