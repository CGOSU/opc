import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// shadcn/ui base-nova primitives, styled with the admin's existing tokens.
export const AlertDialog = AlertDialogPrimitive.Root;

export function AlertDialogTrigger(props: AlertDialogPrimitive.Trigger.Props) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  );
}

export function AlertDialogContent({
  className,
  ...props
}: AlertDialogPrimitive.Popup.Props) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Backdrop
        data-slot="alert-dialog-overlay"
        className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-[2px]"
      />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        className={(state) =>
          cn(
            "fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[calc(100dvh-2rem)] max-w-md -translate-y-1/2 space-y-4 overflow-y-auto rounded-panel border border-border bg-card p-page shadow-xl outline-none",
            typeof className === "function" ? className(state) : className,
          )
        }
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

export function AlertDialogTitle(props: AlertDialogPrimitive.Title.Props) {
  return (
    <AlertDialogPrimitive.Title data-slot="alert-dialog-title" {...props} />
  );
}

export function AlertDialogDescription(
  props: AlertDialogPrimitive.Description.Props,
) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      {...props}
    />
  );
}

export function AlertDialogCancel(props: AlertDialogPrimitive.Close.Props) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      render={<Button type="button" variant="outline" />}
      {...props}
    />
  );
}
