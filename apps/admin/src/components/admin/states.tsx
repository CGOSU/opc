import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../ui/button";

export function LoadingState({ message = "正在加载…" }: { message?: string }) {
  return (
    <p
      role="status"
      className="inline-flex items-center gap-2 text-muted-foreground"
    >
      <LoaderCircle
        size={16}
        aria-hidden="true"
        className="motion-safe:animate-spin"
      />
      {message}
    </p>
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
      <p
        role="alert"
        className="rounded-control bg-destructive-surface px-3 py-2 text-destructive"
      >
        {message}
      </p>
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
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="space-y-2 px-page py-10 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
