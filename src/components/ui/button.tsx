import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-[opacity,transform,background-color,color,box-shadow] duration-150 ease-out disabled:pointer-events-none disabled:opacity-40 active:not-disabled:scale-[0.98] outline-none focus-visible:shadow-[0_0_0_2px_var(--color-bg),0_0_0_4px_var(--color-accent)]",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-fg hover:opacity-90",
        ghost: "bg-transparent text-muted hover:text-fg hover:bg-fg/10",
        outline: "bg-transparent text-fg shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-fg/10",
        paper: "bg-paper text-ink hover:opacity-90",
        danger: "text-danger hover:bg-fg/10",
      },
      size: {
        sm: "h-8 rounded-md px-2.5 text-xs",
        md: "h-9 rounded-md px-3 text-sm",
        icon: "size-8 rounded-md",
        iconSm: "size-7 rounded-sm",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
