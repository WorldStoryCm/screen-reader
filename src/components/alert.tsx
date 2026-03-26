import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { ComponentProps } from "react";
import { cn } from "./component.utils";

const alertVariants = cva("relative w-full rounded-lg p-4", {
  variants: {
    variant: {
      default: "bg-emerald-50 text-foreground border border-emerald-300/60",
      stone: "bg-stone-50",
      rose: "bg-rose-50",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface AlertProps
  extends ComponentProps<"div">, VariantProps<typeof alertVariants> {
  icon?: React.ReactNode;
}

function Alert({ className, variant, icon, children, ...props }: AlertProps) {
  const childArray = React.Children.toArray(children);

  // Separate title and description from children
  const title = childArray.find(
    (child) => React.isValidElement(child) && child.type === AlertTitle
  );

  const description = childArray.find(
    (child) => React.isValidElement(child) && child.type === AlertDescription
  );

  // Get remaining children (not title or description)
  const otherChildren = childArray.filter(
    (child) =>
      !(
        React.isValidElement(child) &&
        (child.type === AlertTitle || child.type === AlertDescription)
      )
  );

  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {/* Simple 3-column layout */}
      <div className="flex items-start gap-4">
        {/* Left column: Icon */}
        {icon && (
          <div className="flex size-5 flex-shrink-0 items-center justify-center">
            {icon}
          </div>
        )}

        {/* Middle column: Content */}
        <div className="flex min-w-0 flex-grow flex-col gap-1">
          {title}
          {description}
          {otherChildren.length > 0 && otherChildren}
        </div>
      </div>
    </div>
  );
}

function AlertTitle({ className, ...props }: ComponentProps<"h5">) {
  return (
    <h5
      className={cn("leading-tight font-medium tracking-tight", className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("text-foreground leading-tight", className)}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
