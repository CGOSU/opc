import { AlertTriangle } from "lucide-react";
import { useRef, type ReactElement, type RefObject } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { ErrorState } from "./states";

type ConfirmDialogProps = {
  trigger?: ReactElement;
  returnFocusRef?: RefObject<HTMLElement | null>;
  title: string;
  description: string;
  confirmLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending?: boolean;
  error?: string;
};

// The caller closes the dialog after a successful mutation; a failure stays visible here.
export function ConfirmDialog({
  trigger,
  returnFocusRef,
  title,
  description,
  confirmLabel,
  open,
  onOpenChange,
  onConfirm,
  pending,
  error,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next, details) => {
        if (pending) details.cancel();
        else onOpenChange(next);
      }}
    >
      {trigger && <AlertDialogTrigger render={trigger} />}
      <AlertDialogContent
        initialFocus={cancelRef}
        finalFocus={trigger ? undefined : returnFocusRef}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-control border border-destructive-border bg-destructive-surface text-destructive"
          >
            <AlertTriangle size={18} />
          </span>
          <div className="min-w-0 space-y-1.5">
            <AlertDialogTitle className="text-base font-semibold tracking-tight text-foreground">
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              {description}
            </AlertDialogDescription>
          </div>
        </div>
        {error && <ErrorState message={error} />}
        <div
          className="flex flex-wrap justify-end gap-2 border-t border-border pt-4"
          aria-busy={pending}
        >
          <AlertDialogCancel ref={cancelRef} aria-disabled={pending}>
            取消
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "正在处理…" : confirmLabel}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
