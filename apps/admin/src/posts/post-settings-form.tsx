import {
  Controller,
  type SubmitHandler,
  type UseFormReturn,
} from "react-hook-form";
import { CoverImageField } from "../components/admin/cover-image-field";
import { ErrorState } from "../components/admin/states";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { cn } from "../lib/utils";
import type { Term } from "../taxonomy/api";
import type { TopicRow } from "../topics/api";
import { TopicSelector } from "../topics/topic-selector";
import type { PostSettings } from "./api";

export function PostSettingsForm({
  settings,
  categories,
  tags,
  topics,
  onSave,
  pending,
  usesLegacyCover,
  error,
}: {
  settings: UseFormReturn<PostSettings>;
  categories: Term[];
  tags: Term[];
  topics: TopicRow[];
  onSave?: SubmitHandler<PostSettings>;
  pending: boolean;
  usesLegacyCover: boolean;
  error?: string;
}) {
  const { errors: settingsErrors, isDirty } = settings.formState;

  return (
    <form
      noValidate
      onSubmit={
        onSave && isDirty
          ? settings.handleSubmit(onSave)
          : (event) => event.preventDefault()
      }
      className="overflow-hidden rounded-panel border border-border bg-card shadow-[0_1px_3px_rgba(24,24,27,0.04)] xl:sticky xl:top-20"
    >
      <header className="border-b border-border bg-background/60 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-foreground">
          共享设置（全语言共用）
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          分类、标签、专题关联与封面图在中英文间共享
        </p>
      </header>
      <fieldset disabled={pending} className="space-y-5 p-5">
        <Controller
          control={settings.control}
          name="coverImage"
          rules={{
            validate: (value) =>
              !value?.trim() ||
              /^https?:\/\//.test(URL.parse(value.trim())?.href ?? "") ||
              "请输入有效的 HTTP 或 HTTPS URL。",
          }}
          render={({ field }) => (
            <CoverImageField
              id="post-cover-image"
              label="封面图"
              value={field.value ?? ""}
              onChange={(next) => field.onChange(next)}
              disabled={pending}
              previewAlt="文章共享封面预览"
              error={settingsErrors.coverImage?.message}
            />
          )}
        />

        {usesLegacyCover && (
          <div className="space-y-2 rounded-control border border-border bg-background/70 p-3 text-xs text-muted-foreground">
            <p>
              当前保留各语言的历史封面。上传或填写共享封面后，它将用于所有语言。
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                settings.setValue("coverImage", "", { shouldDirty: true })
              }
            >
              清除历史封面
            </Button>
          </div>
        )}

        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          <span>分类</span>
          <Select className="w-full" {...settings.register("categoryId")}>
            <option value="">未分类</option>
            {categories.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">标签</legend>
          <Controller
            control={settings.control}
            name="tagIds"
            rules={{
              validate: (ids) =>
                (ids?.length ?? 0) <= 100 || "最多选择 100 个标签。",
            }}
            render={({ field, fieldState }) => (
              <>
                {tags.length ? (
                  <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto rounded-control border border-border bg-background/50 p-2">
                    {tags.map(({ id, name }) => {
                      const checked = field.value?.includes(id) ?? false;
                      return (
                        <label
                          key={id}
                          className={cn(
                            "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors select-none",
                            checked
                              ? "border-foreground bg-card font-medium text-foreground shadow-[0_1px_2px_rgba(24,24,27,0.04)]"
                              : "border-border bg-card/70 text-muted-foreground hover:border-input hover:text-foreground",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="accent-primary"
                            checked={checked}
                            onChange={(e) => {
                              const selected = field.value ?? [];
                              field.onChange(
                                e.target.checked
                                  ? [...selected, id]
                                  : selected.filter((tag) => tag !== id),
                              );
                            }}
                          />
                          <span>{name}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">尚无标签。</p>
                )}
                {fieldState.error && (
                  <p role="alert" className="text-xs text-destructive">
                    {fieldState.error.message}
                  </p>
                )}
              </>
            )}
          />
        </fieldset>

        <Controller
          control={settings.control}
          name="topicIds"
          render={({ field }) => (
            <TopicSelector
              topics={topics}
              selected={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />

        {error && <ErrorState message={error} />}

        {onSave && (
          <div className="border-t border-border pt-4">
            <Button type="submit" className="w-full" disabled={!isDirty}>
              {pending ? "正在保存…" : "保存共享设置"}
            </Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}
