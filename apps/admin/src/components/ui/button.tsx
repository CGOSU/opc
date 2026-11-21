import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

export const buttonVariants = cva(
  "inline-flex h-control shrink-0 items-center justify-center gap-2 rounded-control text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
        outline:
          "border border-input bg-card hover:bg-accent active:bg-accent/80",
        ghost: "hover:bg-accent active:bg-accent/80",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 active:bg-destructive/80",
      },
      size: {
        default: "px-4",
        sm: "px-2.5",
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
