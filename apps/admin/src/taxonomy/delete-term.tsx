import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmDialog } from "../components/admin/confirm-dialog";
import { Button } from "../components/ui/button";
import { removeTerm, type TaxonomyKind, type Term } from "./api";

export function DeleteTerm({
  kind,
  term,
  label,
  onDeleted,
}: {
  kind: TaxonomyKind;
  term: Term;
  label: string;
  onDeleted: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const remove = useMutation({
    mutationFn: () => removeTerm(kind, term.id),
    onSuccess: async () => {
      setOpen(false);
      await onDeleted();
    },
  });

  if (kind === "categories" && term.articleCount > 0) {
    return <span className="px-2 text-muted-foreground">关联中，不可删除</span>;
  }

  const effect =
    kind === "tags"
      ? "删除仅清除标签及其关联，不会删除文章。"
      : "删除后无法恢复。";
  return (
    <ConfirmDialog
      trigger={
        <Button
          type="button"
          variant="ghost"
          aria-label={`删除${label}：${term.name}`}
        >
          删除
        </Button>
      }
      title={`删除${label}？`}
      description={`“${term.name}”关联了 ${term.articleCount} 篇文章。${effect}`}
      confirmLabel="确认删除"
      open={open}
      pending={remove.isPending}
      error={remove.error?.message}
      onOpenChange={(next) => {
        remove.reset();
        setOpen(next);
      }}
      onConfirm={() => remove.mutate()}
    />
  );
}
