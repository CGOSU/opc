import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "h-control w-full rounded-control border border-input bg-card px-3 text-base outline-none transition-colors duration-150 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 disabled:opacity-60 aria-invalid:border-destructive sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}
