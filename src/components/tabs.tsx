"use client";

import { Typography } from "@/components/Typography";
import { cn } from "@/components/component.utils";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Loader2 } from "lucide-react";
import * as React from "react";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  actions?: React.ReactNode;
}
>(({ className, actions, ...props }, ref) => (
  <div className="flex w-full items-center justify-between border-b border-border/60">
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "flex h-8 items-center gap-6",
        className
      )}
      {...props}
    />
    {actions && (
      <div className="ml-auto flex items-center gap-2">
        {actions}
      </div>
    )}
  </div>
));

TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
  counter?: number;
  isLoading?: boolean;
}
>(({ className, counter, isLoading, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      [
        "relative inline-flex items-center gap-2 cursor-pointer" ,
        "h-8 px-1",
        "text-sm font-medium",
        "text-muted-foreground",
        "transition-colors",
        "hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0",

        // Active
        "data-[state=active]:text-foreground",
        "data-[state=active]:after:absolute",
        "data-[state=active]:after:-bottom-[1px]",
        "data-[state=active]:after:left-0",
        "data-[state=active]:after:h-[2px]",
        "data-[state=active]:after:w-full",
        "data-[state=active]:after:rounded-full",
        "data-[state=active]:after:bg-foreground",
      ].join(" "),
      className
    )}
    {...props}
  >
    <span>{children}</span>

    {(typeof counter !== "undefined" || isLoading) && (
      <span
        className={cn(
          "ml-1 inline-flex min-w-[20px] items-center justify-center rounded-full px-2 text-sm",
          "bg-muted text-muted-foreground",
          "data-[state=active]:bg-foreground data-[state=active]:text-background"
        )}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          counter
        )}
      </span>
    )}
  </TabsPrimitive.Trigger>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-6 focus-visible:outline-none",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
