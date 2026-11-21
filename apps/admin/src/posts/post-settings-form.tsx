import {
  Controller,
  type SubmitHandler,
  type UseFormReturn,
} from "react-hook-form";
import { ErrorState } from "../components/admin/states";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
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
      className="rounded-panel border border-border bg-card p-4 sm:p-page"
    >
      <fieldset disabled={pending} className="space-y-5">
        <legend className="font-medium">文章设置（所有语言共用）</legend>
        <label className="grid gap-2 font-medium">
          封面 URL
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
              <Input
                {...field}
                type="url"
                value={field.value ?? ""}
                maxLength={2048}
                aria-invalid={!!settingsErrors.coverImage}
              />
            )}
          />
          {settingsErrors.coverImage && (
            <span role="alert" className="text-destructive">
              {settingsErrors.coverImage.message}
            </span>
          )}
        </label>
        {usesLegacyCover && (
          <p className="text-sm text-muted-foreground">
            当前保留各语言的历史封面。填写共享封面后，它将用于所有语言。
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                settings.setValue("coverImage", "", { shouldDirty: true })
              }
            >
              清除历史封面
            </Button>
          </p>
        )}
        <label className="grid gap-2 font-medium">
          分类
          <select
            className="min-h-control rounded-control border border-border bg-card px-3"
            {...settings.register("categoryId")}
          >
            <option value="">未分类</option>
            {categories.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="space-y-2">
          <legend className="font-medium">标签</legend>
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
                  <div className="flex max-h-48 flex-wrap gap-x-5 gap-y-3 overflow-y-auto p-1">
                    {tags.map(({ id, name }) => (
                      <label key={id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={field.value?.includes(id) ?? false}
                          onChange={(e) => {
                            const selected = field.value ?? [];
                            field.onChange(
                              e.target.checked
                                ? [...selected, id]
                                : selected.filter((tag) => tag !== id),
                            );
                          }}
                        />
                        {name}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">尚无标签。</p>
                )}
                {fieldState.error && (
                  <p role="alert" className="text-destructive">
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
          <Button type="submit" disabled={!isDirty}>
            {pending ? "正在保存…" : "保存共享设置"}
          </Button>
        )}
      </fieldset>
    </form>
  );
}
