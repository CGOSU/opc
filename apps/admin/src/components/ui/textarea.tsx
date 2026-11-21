import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";
import { fieldBaseClass } from "./input";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldBaseClass, "resize-y px-3 py-2", className)}
      {...props}
    />
  );
}
