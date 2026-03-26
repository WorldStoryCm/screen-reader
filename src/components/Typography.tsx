/**
 * Defaults taken from shadcn's typography scale
 */

"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "./component.utils";

const typoVariants = cva("", {
  variants: {
    variant: {
      span: "text-[1rem]",
      h1: "text-[2.5rem] leading-[5.125rem] font-medium",
      h2: "text-[2rem] leading-[2.25rem] font-medium",
      h3: "text-[1.5rem] leading-[2rem] font-medium",
      h4: "text-[1.25rem] leading-[1.75rem] font-medium",
      h5: "text-[1rem] leading-[1.5rem] font-medium",
      p: "text-[1rem] leading-[1.5rem]",
      body2: "text-[1rem] leading-[1.25rem]",
      small: "text-[1rem]",
      extraSmall: "text-[0.875rem]",
    },
  },
  defaultVariants: {
    variant: "span",
  },
});

type Props<T extends SupportedElementTags> =
  React.HTMLAttributes<SupportedElements> &
    VariantProps<typeof typoVariants> & {
      as?: T;
      small?: boolean;
      muted?: boolean;
      ref?: React.ForwardedRef<SupportedElements>;
    };

export const Typography = <T extends SupportedElementTags>({
  className,
  variant,
  as = "span" as T,
  muted = false,
  ref,
  ...props
}: Props<T>) => {
  const Comp = as as React.ElementType;

  return (
    <Comp
      className={cn(
        typoVariants({ variant, className }),
        { "text-stone-400": muted },
        className
      )}
      ref={ref}
      {...props}
    />
  );
};

Typography.displayName = "Typography";

type SupportedElementsMap = Pick<
  HTMLElementTagNameMap,
  "label" | "p" | "span" | "h1" | "h2" | "h3" | "h4" | "h5" | "div"
>;

type SupportedElementTags = keyof SupportedElementsMap;
type SupportedElements = SupportedElementsMap[SupportedElementTags];
