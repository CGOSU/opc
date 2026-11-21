import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

export const buttonVariants = cva(
  "inline-flex h-control shrink-0 cursor-pointer items-center justify-center gap-2 rounded-control text-sm font-medium outline-none transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(24,24,27,0.14)] hover:bg-primary/90 active:bg-primary/85",
        outline:
          "border border-border bg-card text-foreground shadow-[0_1px_2px_rgba(24,24,27,0.04)] hover:border-input hover:bg-background active:bg-accent",
        ghost: "text-foreground hover:bg-accent active:bg-accent/80",
        destructive:
          "bg-destructive text-white shadow-[0_1px_2px_rgba(185,28,28,0.16)] hover:bg-destructive/90 active:bg-destructive/85",
      },
      size: {
        default: "px-3.5",
        sm: "h-8 px-2.5 text-xs",
        icon: "w-control",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
