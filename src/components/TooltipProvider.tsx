"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "./component.utils";

const TooltipProvider = ({
  delayDuration = 0,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) => (
  <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
);

const Tooltip = TooltipPrimitive.Root;

function TooltipTrigger({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger> & {
  ref?: React.Ref<React.ComponentRef<typeof TooltipPrimitive.Trigger>>;
}) {
  return (
    <TooltipPrimitive.Trigger
      ref={ref}
      className={cn("cursor-help", className)}
      {...props}
    />
  );
}

function TooltipContent({
  className,
  sideOffset = 4,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
  ref?: React.Ref<React.ComponentRef<typeof TooltipPrimitive.Content>>;
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-50 overflow-hidden rounded-lg border bg-white px-3 py-1.5 text-sm text-stone-900 shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

// Mobile-friendly tooltip that works with both hover and tap
// On desktop: Shows tooltip on hover with configurable delay
// On mobile/touch devices: Shows tooltip on tap/click, closes when tapping outside
interface MobileTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  delayDuration?: number;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
  sideOffset?: number;
}

function MobileTooltip({
  children,
  content,
  delayDuration = 0,
  side = "top",
  align = "center",
  className,
  sideOffset = 4,
}: MobileTooltipProps) {
  const [open, setOpen] = React.useState(false);
  const [isTouchDevice, setIsTouchDevice] = React.useState(false);

  React.useEffect(() => {
    // Detect if this is a touch device
    const checkTouchDevice = () => {
      setIsTouchDevice(
        "ontouchstart" in window || navigator.maxTouchPoints > 0,
      );
    };

    checkTouchDevice();
    window.addEventListener("resize", checkTouchDevice);

    return () => window.removeEventListener("resize", checkTouchDevice);
  }, []);

  React.useEffect(() => {
    // Close tooltip when clicking outside on touch devices
    if (!isTouchDevice || !open) return;

    const handleClickOutside = (event: TouchEvent | MouseEvent) => {
      const target = event.target as Element;
      const tooltipElements = document.querySelectorAll(
        "[data-radix-tooltip-content]",
      );
      const triggerElements = document.querySelectorAll(
        "[data-radix-tooltip-trigger]",
      );

      const isClickingTooltip = Array.from(tooltipElements).some((el) =>
        el.contains(target),
      );
      const isClickingTrigger = Array.from(triggerElements).some((el) =>
        el.contains(target),
      );

      if (!isClickingTooltip && !isClickingTrigger) {
        setOpen(false);
      }
    };

    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isTouchDevice, open]);

  const handleTriggerClick = React.useCallback(
    (event: React.MouseEvent) => {
      if (isTouchDevice) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    },
    [isTouchDevice],
  );

  return (
    <Tooltip
      open={open}
      onOpenChange={setOpen}
      delayDuration={isTouchDevice ? 0 : delayDuration}
    >
      <TooltipTrigger asChild>
        <div onClick={handleTriggerClick}>{children}</div>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        className={className}
        sideOffset={sideOffset}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  MobileTooltip,
};
