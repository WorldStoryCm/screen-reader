"use client";

import { cn } from "@/components/component.utils";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import * as React from "react";
import { ComponentProps } from "react";
import { Button } from "@/components/button";
import { Typography } from "@/components/Typography";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps extends ComponentProps<
  typeof DialogPrimitive.Content
> {
  overlayClassName?: string;
  accessibleTitle?: string;
}
function DialogContent({
  className,
  children,
  overlayClassName,
  accessibleTitle = "Dialog",
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          "data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2",
          "data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed top-[50%] left-[50%] z-50",
          "grid w-auto max-w-full min-w-[300px] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-x-auto border p-4 shadow-lg duration-200 sm:rounded-lg",
          className
        )}
        {...props}
      >
        {children}
        <VisuallyHidden>
          <DialogTitle>{accessibleTitle}</DialogTitle>
        </VisuallyHidden>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

DialogContent.displayName = DialogPrimitive.Content.displayName;

interface DialogHeaderProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  title?: React.ReactNode;
  showCloseButton?: boolean;
  disableCloseButton?: boolean;
  onClose?: (e: React.MouseEvent) => void;
}

/**
 * DialogHeader component - can be used within a Dialog or standalone with onClose prop
 */
function DialogHeader({
  className,
  title,
  showCloseButton = true,
  disableCloseButton = false,
  onClose,
  children,
  ...props
}: DialogHeaderProps) {
  return (
    <div
      className={cn("flex w-full items-center border-b", className)}
      {...props}
    >
      {title && (
        <div className="grid flex-1 leading-none font-medium tracking-tight">
          <Typography variant="h5" className="truncate">
            {title}
          </Typography>
        </div>
      )}

      <div className="ml-auto flex h-full items-stretch gap-2">
        {children}
        {showCloseButton && onClose ? (
          <Button
            variant="ghost"
            size="icon"
            // className="ring-offset-background hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none flex items-center h-full flex-shrink-0 justify-center"
            onClick={onClose}
            disabled={disableCloseButton}
            aria-label="Close dialog"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        ) : showCloseButton ? (
          <DialogClose
            asChild
            tabIndex={-1}
            disabled={disableCloseButton}
            aria-label="Close dialog"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={disableCloseButton}
              aria-label="Close dialog"
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </DialogClose>
        ) : null}
      </div>
    </div>
  );
}

DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg leading-none font-semibold tracking-tight",
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
