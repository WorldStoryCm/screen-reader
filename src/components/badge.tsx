import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/components/component.utils";

const badgeVariants = cva(
  [
    "inline-flex items-center justify-center",
    "rounded-full",
    "px-3 py-1",
    "text-[13px] leading-none",
    "whitespace-nowrap",
    "shrink-0 w-fit",
    "gap-1.5",
    "[&>svg]:size-3 [&>svg]:shrink-0 [&>svg]:opacity-80",
    "ring-1 ring-inset",
    "transition-colors",
    "select-none",
  ].join(" "),
  {
    variants: {
      variant: {
        // нейтральный “system tag”
        default:
          "bg-stone-100/80 text-stone-800 ring-stone-200/80 hover:bg-stone-900",

        secondary: "bg-white text-stone-700 ring-stone-200 hover:bg-stone-200/80",

        destructive: "bg-red-50 text-red-700 ring-red-200 hover:bg-red-100",

        outline:
          "bg-gradient-to-b from-white to-stone-50 text-stone-700 ring-stone-200 hover:from-stone-50 hover:to-stone-100/60",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
