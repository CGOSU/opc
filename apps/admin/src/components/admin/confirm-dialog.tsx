import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertTriangle } from "lucide-react";
import { useRef, type ReactElement, type RefObject } from "react";
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
  const previousFocus = useRef(document.activeElement);
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      {trigger && <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-[2px]" />
        <AlertDialog.Content
          onCloseAutoFocus={
            trigger
              ? undefined
              : (event) => {
                  const element =
                    returnFocusRef?.current ?? previousFocus.current;
                  if (element instanceof HTMLElement && element.isConnected) {
                    event.preventDefault();
                    element.focus();
                  }
                }
          }
          className="fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[calc(100dvh-2rem)] max-w-md -translate-y-1/2 space-y-4 overflow-y-auto rounded-panel border border-border bg-card p-page shadow-xl outline-none"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-control border border-destructive-border bg-destructive-surface text-destructive"
            >
              <AlertTriangle size={18} />
            </span>
            <div className="min-w-0 space-y-1.5">
              <AlertDialog.Title className="text-base font-semibold tracking-tight text-foreground">
                {title}
              </AlertDialog.Title>
              <AlertDialog.Description className="text-sm text-muted-foreground">
                {description}
              </AlertDialog.Description>
            </div>
          </div>
          {error && <ErrorState message={error} />}
          <div
            className="flex flex-wrap justify-end gap-2 border-t border-border pt-4"
            aria-busy={pending}
          >
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="outline" aria-disabled={pending}>
                取消
              </Button>
            </AlertDialog.Cancel>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={onConfirm}
            >
              {pending ? "正在处理…" : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
