import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

export const fieldBaseClass =
  "w-full rounded-control border border-border bg-card text-base text-foreground shadow-[0_1px_2px_rgba(24,24,27,0.03)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/80 hover:border-input focus-visible:border-foreground focus-visible:ring-3 focus-visible:ring-foreground/8 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/15 sm:text-sm";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(fieldBaseClass, "h-control px-3", className)}
      {...props}
    />
  );
}
