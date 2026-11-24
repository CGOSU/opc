import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  Plus,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { ConfirmDialog } from "../components/admin/confirm-dialog";
import { PageHeader } from "../components/admin/page-header";
import { SearchInput } from "../components/admin/search-input";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/admin/states";
import { Button, buttonVariants } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { cn } from "../lib/utils";
import {
  createJobSource,
  deleteJobSource,
  jobsKey,
  jobSourcesKey,
  jobSourcesQuery,
  relationshipLabels,
  updateJobSource,
  type JobSourceRow,
  type SourceRelationship,
} from "./api";
import { SourceStatusBadge } from "./job-badges";

type SourceFormState = {
  handle: string;
  displayName: string;
  bioZh: string;
  bioEn: string;
  relationship: SourceRelationship;
  optOut: boolean;
  optOutNote: string;
  takedownExistingJobs: boolean;
};

const emptyForm: SourceFormState = {
  handle: "",
  displayName: "",
  bioZh: "",
  bioEn: "",
  relationship: "public",
  optOut: false,
  optOutNote: "",
  takedownExistingJobs: true,
};

function initialsOf(name: string, handle: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  if (letters.length >= 2) return letters.slice(0, 2);
  return handle.slice(0, 2).toUpperCase() || "X";
}

export default function JobSourcesPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "active" | "blocked">("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<JobSourceRow | null>(null);
  const [form, setForm] = useState<SourceFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JobSourceRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);

  const listQuery = useQuery(
    jobSourcesQuery({
      optOut: filter,
      search: search.trim() || undefined,
    }),
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return updateJobSource(editing.id, {
          displayName: form.displayName.trim(),
          bioZh: form.bioZh.trim(),
          bioEn: form.bioEn.trim(),
          relationship: form.relationship,
          optOut: form.optOut,
          optOutNote: form.optOutNote.trim(),
          takedownExistingJobs: form.optOut ? form.takedownExistingJobs : false,
        });
      }
      return createJobSource({
        handle: form.handle.trim(),
        displayName: form.displayName.trim(),
        bioZh: form.bioZh.trim(),
        bioEn: form.bioEn.trim(),
        relationship: form.relationship,
        optOut: form.optOut,
        optOutNote: form.optOutNote.trim(),
      });
    },
    onSuccess: () => {
      toast.success(editing ? "已更新博主档案" : "已添加博主档案");
      setDialogOpen(false);
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: jobSourcesKey });
      void queryClient.invalidateQueries({ queryKey: jobsKey });
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "保存博主档案失败");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteJobSource(id),
    onSuccess: () => {
      toast.success("已删除博主档案");
      setDeleteTarget(null);
      setDeleteError(undefined);
      void queryClient.invalidateQueries({ queryKey: jobSourcesKey });
      void queryClient.invalidateQueries({ queryKey: jobsKey });
    },
    onError: (err) => {
      setDeleteError(err instanceof Error ? err.message : "删除失败");
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(source: JobSourceRow) {
    setEditing(source);
    setForm({
      handle: source.handle,
      displayName: source.displayName,
      bioZh: source.bioZh,
      bioEn: source.bioEn,
      relationship: source.relationship,
      optOut: source.optOut,
      optOutNote: source.optOutNote,
      takedownExistingJobs: !source.optOut,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    saveMutation.mutate();
  }

  const counts = listQuery.data?.counts;

  return (
    <div className="space-y-6">
      <PageHeader
        title="博主源档案与拒收名单（job_sources）"
        description="集中维护知名博主 X 账号、合作授权关系与拒收保护；标记为 opt_out 的账号在粘贴链接录入时会自动拦截。"
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus size={15} aria-hidden="true" />
            新增博主档案
          </Button>
        }
      />

      <section className="overflow-hidden rounded-panel border border-border bg-card shadow-[0_1px_3px_rgba(24,24,27,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-control bg-muted p-1">
              {(
                [
                  ["all", "全部", counts?.total],
                  ["active", "正常收录", counts?.active],
                  ["blocked", "拒收名单", counts?.blocked],
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={cn(
                    "cursor-pointer rounded-[6px] px-2.5 py-1 text-xs font-medium transition-colors",
                    filter === key
                      ? "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(24,24,27,0.06)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                  {count !== undefined && (
                    <span className="ml-1 font-mono text-[11px] opacity-75">
                      ({count})
                    </span>
                  )}
                </button>
              ))}
            </div>
            <span className="hidden font-mono text-[11px] text-muted-foreground md:inline">
              表：job_sources (handle 唯一索引)
            </span>
          </div>

          <SearchInput
            label="搜索博主名称或 @handle"
            placeholder="搜索名称、@handle 或简介…"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            onClear={() => setSearch("")}
            className="h-8 w-56 text-xs"
          />
        </div>

        {listQuery.isPending ? (
          <div className="p-8">
            <LoadingState message="正在读取博主档案…" />
          </div>
        ) : listQuery.isError ? (
          <div className="p-6">
            <ErrorState
              message={listQuery.error.message}
              onRetry={() => void listQuery.refetch()}
              retrying={listQuery.isFetching}
            />
          </div>
        ) : listQuery.data.items.length === 0 ? (
          <EmptyState
            icon={<Users size={18} />}
            title="暂无匹配的博主档案"
            description="你可以先手动建档，或在「粘贴 X 链接录入」岗位时由系统自动建立博主档案。"
            action={
              <Button type="button" size="sm" onClick={openCreate}>
                <Plus size={14} aria-hidden="true" />
                新增博主档案
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-background/70 text-[11px] font-semibold text-muted-foreground">
                  <th className="w-[24%] px-4 py-2.5 sm:px-5">博主与 X 账号</th>
                  <th className="w-[29%] px-3 py-2.5">简介 / 撤稿说明</th>
                  <th className="w-[16%] px-3 py-2.5">关系与收录状态</th>
                  <th className="w-[15%] px-3 py-2.5">收录岗位</th>
                  <th className="w-[16%] px-4 py-2.5 text-right sm:px-5">
                    管理操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {listQuery.data.items.map((source) => (
                  <tr
                    key={source.id}
                    className={cn(
                      "transition-colors hover:bg-background/60",
                      source.optOut &&
                        "bg-destructive-surface/65 hover:bg-destructive-surface",
                    )}
                  >
                    <td className="px-4 py-3.5 align-middle sm:px-5">
                      <div className="flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "grid size-8.5 shrink-0 place-items-center rounded-full border text-[11px] font-bold",
                            source.optOut
                              ? "border-destructive-border bg-destructive-surface text-destructive"
                              : "border-border bg-muted text-foreground",
                          )}
                        >
                          {source.optOut
                            ? "NO"
                            : initialsOf(source.displayName, source.handle)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground">
                            {source.displayName}
                          </div>
                          <a
                            href={source.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            @{source.handle}
                            <ExternalLink size={10} aria-hidden="true" />
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      {source.optOut ? (
                        <p className="text-destructive">
                          {source.optOutNote || "已列入拒收名单，禁止后续收录。"}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">
                          {source.bioZh || source.bioEn || "暂无简介"}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      <SourceStatusBadge
                        relationship={source.relationship}
                        optOut={source.optOut}
                      />
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      <span
                        className={cn(
                          "font-mono font-semibold whitespace-nowrap tabular-nums",
                          source.optOut ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {source.optOut
                          ? `0 公开 / ${source.removedCount} 已 410`
                          : `${source.openCount} 在招 / ${source.totalCount} 累计`}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle sm:px-5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant={source.optOut ? "destructive" : "outline"}
                          size="sm"
                          onClick={() => openEdit(source)}
                        >
                          {source.optOut ? "查看 / 调整" : "编辑档案"}
                        </Button>
                        {source.totalCount === 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`删除 ${source.displayName}`}
                            onClick={() => {
                              setDeleteError(undefined);
                              setDeleteTarget(source);
                            }}
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Opt-out mechanism explanation card matching prototype */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-border bg-card px-5 py-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <ShieldAlert
              size={15}
              aria-hidden="true"
              className="text-destructive"
            />
            拒收拦截机制说明
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            当博主申请「撤下并加入不收录名单」后，管理员开启{" "}
            <code className="font-mono text-foreground">opt_out = true</code>：
            1) 可一键将该博主名下现有岗位全部转为{" "}
            <code className="font-mono text-foreground">removed</code>（HTTP
            410）；2) 后续粘贴该账号推文链接时，
            <code className="font-mono text-foreground">parse-url</code>{" "}
            与录入接口将强制阻断。
          </p>
        </div>
        <Link
          to="/jobs"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          返回招聘列表
        </Link>
      </section>

      {/* Create / Edit Source Dialog */}
      <Dialog.Root
        open={dialogOpen}
        onOpenChange={(next) => {
          if (!saveMutation.isPending) setDialogOpen(next);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-[2px]" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[calc(100dvh-2rem)] max-w-lg -translate-y-1/2 overflow-y-auto rounded-panel border border-border bg-card p-6 shadow-xl outline-none"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3.5">
              <div>
                <Dialog.Title className="text-base font-bold text-foreground">
                  {editing
                    ? `编辑博主档案：@${editing.handle}`
                    : "新增 X 博主档案"}
                </Dialog.Title>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  用于统一归属博主招聘信息、授权关系及拒收名单拦截。
                </p>
              </div>
              <Dialog.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="关闭弹窗"
                >
                  <X size={16} aria-hidden="true" />
                </Button>
              </Dialog.Close>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {formError && <ErrorState message={formError} />}

              {!editing && (
                <div className="space-y-1">
                  <label htmlFor="src-handle" className="text-xs font-semibold">
                    X 账号（Handle）*
                  </label>
                  <Input
                    id="src-handle"
                    required
                    value={form.handle}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        handle: e.currentTarget.value,
                      }))
                    }
                    placeholder="例如 @marc_louvion 或 marc_louvion"
                    className="font-mono text-xs"
                  />
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="src-name" className="text-xs font-semibold">
                    展示名称 *
                  </label>
                  <Input
                    id="src-name"
                    required
                    maxLength={120}
                    value={form.displayName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        displayName: e.currentTarget.value,
                      }))
                    }
                    placeholder="例如 Marc Lou"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="src-rel" className="text-xs font-semibold">
                    合作与授权关系
                  </label>
                  <Select
                    id="src-rel"
                    value={form.relationship}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        relationship: e.currentTarget
                          .value as SourceRelationship,
                      }))
                    }
                  >
                    {(
                      Object.entries(relationshipLabels) as [
                        SourceRelationship,
                        string,
                      ][]
                    ).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="src-bio-zh" className="text-xs font-semibold">
                  中文简介 / 领域标签
                </label>
                <Textarea
                  id="src-bio-zh"
                  rows={2}
                  maxLength={500}
                  value={form.bioZh}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      bioZh: e.currentTarget.value,
                    }))
                  }
                  placeholder="例如：独立产品开发者 · AI SaaS / 远程全栈"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="src-bio-en" className="text-xs font-semibold">
                  English Bio (Optional)
                </label>
                <Textarea
                  id="src-bio-en"
                  rows={2}
                  maxLength={500}
                  value={form.bioEn}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      bioEn: e.currentTarget.value,
                    }))
                  }
                  placeholder="Indie maker sharing remote full-stack & AI roles."
                />
              </div>

              <div className="space-y-2.5 rounded-control border border-destructive-border bg-destructive-surface/50 p-3.5">
                <label className="flex cursor-pointer items-start gap-2.5 text-xs font-semibold text-destructive">
                  <input
                    type="checkbox"
                    checked={form.optOut}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        optOut: e.currentTarget.checked,
                      }))
                    }
                    className="mt-0.5 size-4 rounded border-destructive accent-destructive"
                  />
                  <span>
                    加入拒收名单（opt_out = true）：永久禁止录入此博主的 X 推文
                  </span>
                </label>

                {form.optOut && (
                  <div className="space-y-2.5 pl-6">
                    <Textarea
                      rows={2}
                      maxLength={500}
                      value={form.optOutNote}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          optOutNote: e.currentTarget.value,
                        }))
                      }
                      placeholder="记录撤稿来源与日期（例如：2026-11-24 通过邮件申请撤下并拒绝后续收录）"
                      className="bg-card text-xs"
                    />
                    {editing && editing.totalCount > editing.removedCount && (
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-destructive">
                        <input
                          type="checkbox"
                          checked={form.takedownExistingJobs}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              takedownExistingJobs: e.currentTarget.checked,
                            }))
                          }
                          className="size-4 rounded border-destructive accent-destructive"
                        />
                        <span>
                          同时将该博主现有未撤下招聘全部标记为「已撤下 410」
                        </span>
                      </label>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saveMutation.isPending}
                  onClick={() => setDialogOpen(false)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "保存中…" : "保存博主档案"}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(undefined);
          }
        }}
        title={
          deleteTarget ? `确认删除博主 @${deleteTarget.handle}？` : "确认删除？"
        }
        description="仅未关联任何招聘条目的博主可直接删除；若希望保留拒收拦截记录，请保留档案并开启 opt_out。"
        confirmLabel="确认删除"
        pending={deleteMutation.isPending}
        error={deleteError}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
