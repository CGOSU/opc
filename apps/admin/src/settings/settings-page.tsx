import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "../components/admin/page-header";
import { ErrorState, LoadingState } from "../components/admin/states";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { adminApi, writeOptions } from "../lib/admin-api";
import { readResult } from "../taxonomy/api";

const settings = adminApi.settings;
type SettingsInput = Parameters<typeof settings.put>[0];
const siteSettingsQuery = queryOptions({
  queryKey: ["site-settings"],
  queryFn: ({ signal }) => readResult(settings.get({ fetch: { signal } })),
});
const languages = { zh: "中文", en: "English" } as const;

function SettingsForm({ initial }: { initial: SettingsInput }) {
  const cache = useQueryClient();
  const { handleSubmit, register, reset, formState } = useForm<SettingsInput>({
    defaultValues: initial,
  });
  const save = useMutation({
    mutationFn: (values: SettingsInput) =>
      readResult(settings.put(values, writeOptions)),
    onSuccess: (saved) => {
      cache.setQueryData(siteSettingsQuery.queryKey, saved);
      reset(saved);
      toast.success("基本设置已保存");
    },
  });

  return (
    <form
      className="max-w-3xl space-y-5"
      onSubmit={handleSubmit((values) => save.mutate(values))}
    >
      <p className="text-muted-foreground" id="settings-help">
        站名用于前台页眉、页脚和订阅源。已有文章或专题描述优先；留空沿用原有默认值。
      </p>
      <div
        className="grid gap-5 md:grid-cols-2"
        aria-describedby="settings-help"
      >
        {(["zh", "en"] as const).map((locale) => (
          <fieldset
            key={locale}
            className="min-w-0 space-y-4 rounded-panel border border-border bg-card p-4"
            disabled={save.isPending}
          >
            <legend className="px-1 font-semibold">{languages[locale]}</legend>
            <div className="space-y-2">
              <label htmlFor={`${locale}-site-name`} className="font-medium">
                站名
              </label>
              <Input
                id={`${locale}-site-name`}
                maxLength={80}
                {...register(`${locale}.siteName`)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor={`${locale}-description`} className="font-medium">
                默认 SEO 描述
              </label>
              <textarea
                id={`${locale}-description`}
                rows={4}
                maxLength={320}
                className="w-full resize-y rounded-control border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                {...register(`${locale}.defaultDescription`)}
              />
            </div>
          </fieldset>
        ))}
      </div>
      {save.error && <ErrorState message={save.error.message} />}
      <Button type="submit" disabled={!formState.isDirty || save.isPending}>
        {save.isPending ? "正在保存…" : "保存设置"}
      </Button>
    </form>
  );
}

export default function SettingsPage() {
  const query = useQuery(siteSettingsQuery);
  return (
    <div className="space-y-6">
      <PageHeader
        title="基本设置"
        description="编辑中英文站名和默认 SEO 描述。保存后前台即时更新。"
      />
      {query.data ? (
        <SettingsForm initial={query.data} />
      ) : query.isPending ? (
        <LoadingState />
      ) : (
        <ErrorState
          message="无法读取基本设置。"
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      )}
    </div>
  );
}
