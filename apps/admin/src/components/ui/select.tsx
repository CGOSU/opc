import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

export const selectClass =
  "h-control min-w-0 max-w-full cursor-pointer truncate rounded-control border border-border bg-card px-3 text-sm text-foreground shadow-[0_1px_2px_rgba(24,24,27,0.03)] outline-none transition-[border-color,box-shadow] duration-150 hover:border-input focus-visible:border-foreground focus-visible:ring-3 focus-visible:ring-foreground/8 disabled:cursor-not-allowed disabled:opacity-60";

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(selectClass, className)}
      {...props}
    />
  );
}
