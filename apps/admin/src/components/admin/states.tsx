import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../ui/button";

export function LoadingState({ message = "正在加载…" }: { message?: string }) {
  return (
    <div
      role="status"
      className="inline-flex items-center gap-2.5 rounded-control border border-border bg-card px-3.5 py-2 text-sm text-muted-foreground shadow-[0_1px_2px_rgba(24,24,27,0.03)]"
    >
      <LoaderCircle
        size={15}
        aria-hidden="true"
        className="text-foreground motion-safe:animate-spin"
      />
      <span>{message}</span>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div
        role="alert"
        className="flex items-start gap-2.5 rounded-control border border-destructive-border bg-destructive-surface px-3.5 py-2.5 text-sm text-destructive"
      >
        <AlertCircle
          size={16}
          aria-hidden="true"
          className="mt-0.5 shrink-0"
        />
        <p className="min-w-0 wrap-anywhere">{message}</p>
      </div>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          disabled={retrying}
          onClick={onRetry}
        >
          {retrying ? "正在重试…" : "重试"}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 px-page py-12 text-center">
      <span
        aria-hidden="true"
        className="grid size-10 place-items-center rounded-panel border border-border bg-background text-muted-foreground"
      >
        {icon ?? <Inbox size={18} />}
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="max-w-md text-xs text-muted-foreground sm:text-sm">
          {description}
        </p>
      )}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
