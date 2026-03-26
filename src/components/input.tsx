import { cn } from "@/components/component.utils";
import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  startAddon?: React.ReactNode;
  startAddonSeparator?: React.ReactNode;
  endAddon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type, startAddon, endAddon, startAddonSeparator, ...props },
    ref
  ) => (
    <Wrapper virtual={!startAddon && !endAddon}>
      {startAddon && (
        <span className="absolute left-4 text-stone-500">{startAddon}</span>
      )}
      {startAddonSeparator}
      <input
        type={type}
        className={cn(
          "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-8 w-full rounded-sm border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          {
            "pl-12": startAddon,
            "pr-12": endAddon,
          },
          className
        )}
        ref={ref}
        {...props}
      />
      {endAddon && (
        <span className="absolute right-4 text-stone-500">{endAddon}</span>
      )}
    </Wrapper>
  )
);

Input.displayName = "Input";

const Wrapper = (props: React.PropsWithChildren<{ virtual: boolean }>) =>
  props.virtual ? (
    <>{props.children}</>
  ) : (
    <div className="relative flex w-full items-center">{props.children}</div>
  );
