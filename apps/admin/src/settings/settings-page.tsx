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
import { Textarea } from "../components/ui/textarea";
import { adminApi, writeOptions } from "../lib/admin-api";
import { readResult } from "../taxonomy/api";

const settings = adminApi.settings;
type SettingsInput = Parameters<typeof settings.put>[0];
const siteSettingsQuery = queryOptions({
  queryKey: ["site-settings"],
  queryFn: ({ signal }) => readResult(settings.get({ fetch: { signal } })),
});
const languages = {
  zh: { title: "中文站点", code: "ZH" },
  en: { title: "英文站点", code: "EN" },
} as const;

function SettingsForm({ initial }: { initial: SettingsInput }) {
  const cache = useQueryClient();
  const { handleSubmit, register, watch, reset, formState } =
    useForm<SettingsInput>({
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
      className="max-w-4xl space-y-5"
      onSubmit={handleSubmit((values) => save.mutate(values))}
    >
      <p
        className="rounded-panel border border-border bg-card px-4 py-3 text-xs text-muted-foreground shadow-[0_1px_2px_rgba(24,24,27,0.03)] sm:text-sm"
        id="settings-help"
      >
        站名用于前台页眉、页脚与 RSS 订阅源。具体文章和专题会优先使用各自的 SEO
        描述或摘要；留空时沿用原有默认值。
      </p>
      <div
        className="grid gap-5 md:grid-cols-2"
        aria-describedby="settings-help"
      >
        {(["zh", "en"] as const).map((locale) => {
          const siteNameVal = watch(`${locale}.siteName`) ?? "";
          const descVal = watch(`${locale}.defaultDescription`) ?? "";
          return (
            <fieldset
              key={locale}
              className="min-w-0 overflow-hidden rounded-panel border border-border bg-card shadow-[0_1px_3px_rgba(24,24,27,0.04)]"
              disabled={save.isPending}
            >
              <legend className="sr-only">{languages[locale].title}</legend>
              <div className="flex items-center justify-between gap-2 border-b border-border bg-background/60 px-5 py-3.5">
                <span className="text-sm font-semibold text-foreground">
                  {languages[locale].title}
                </span>
                <span className="rounded-md border border-border bg-card px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
                  {languages[locale].code}
                </span>
              </div>
              <div className="space-y-4 p-5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor={`${locale}-site-name`}
                      className="text-sm font-medium text-foreground"
                    >
                      站名
                    </label>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {siteNameVal.length} / 80
                    </span>
                  </div>
                  <Input
                    id={`${locale}-site-name`}
                    maxLength={80}
                    {...register(`${locale}.siteName`)}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor={`${locale}-description`}
                      className="text-sm font-medium text-foreground"
                    >
                      默认 SEO 描述
                    </label>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {descVal.length} / 320
                    </span>
                  </div>
                  <Textarea
                    id={`${locale}-description`}
                    rows={4}
                    maxLength={320}
                    {...register(`${locale}.defaultDescription`)}
                  />
                </div>
              </div>
            </fieldset>
          );
        })}
      </div>
      {save.error && <ErrorState message={save.error.message} />}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <Button type="submit" disabled={!formState.isDirty || save.isPending}>
          {save.isPending ? "正在保存…" : "保存设置"}
        </Button>
        {formState.isDirty && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-border bg-warning-surface px-2.5 py-0.5 text-xs font-medium text-warning">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-warning"
            />
            有未保存的设置修改
          </span>
        )}
      </div>
    </form>
  );
}

export default function SettingsPage() {
  const query = useQuery(siteSettingsQuery);
  return (
    <div className="space-y-6">
      <PageHeader
        title="基本设置"
        description="分别配置中英文站名与全站默认 SEO 描述。保存后前台即时生效。"
      />
      {query.data ? (
        <SettingsForm initial={query.data} />
      ) : query.isPending ? (
        <LoadingState message="正在读取基本设置…" />
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
