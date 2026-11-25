import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";

// shadcn/ui base-nova primitives, styled with the admin's existing tokens.
export const Dialog = DialogPrimitive.Root;

export function DialogTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

export function DialogContent({
  backdropClassName,
  ...props
}: DialogPrimitive.Popup.Props & { backdropClassName?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="dialog-overlay"
        className={cn(
          "fixed inset-0 z-40 bg-foreground/40 backdrop-blur-[2px]",
          backdropClassName,
        )}
      />
      <DialogPrimitive.Popup data-slot="dialog-content" {...props} />
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle(props: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title data-slot="dialog-title" {...props} />;
}

export function DialogDescription(props: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description data-slot="dialog-description" {...props} />
  );
}

export function DialogClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}
