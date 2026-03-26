"use client";

import { cn } from "@/components/component.utils";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/Form";
import { Input } from "@/components/input";
import type { HTMLInputTypeAttribute } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { InfoIconTooltip, InfoTooltipProps } from "./InfoIconTooltip";

export interface InputControlledProps<
  TFieldValues extends FieldValues,
> extends InfoTooltipProps {
  control?: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  type?: HTMLInputTypeAttribute;
  className?: string;
  autoFocus?: boolean;
}

export const InputControlled = <TFieldValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  disabled,
  type,
  className,
  tooltip,
  tooltipTitle,
  tooltipDescription,
  autoFocus,
}: InputControlledProps<TFieldValues>) => (
  <FormField
    control={control}
    name={name}
    render={({ field }) => (
      <FormItem className={cn("flex flex-col", className)}>
        <FormLabel className="flex items-center gap-1">
          {label}
          <InfoIconTooltip
            tooltip={tooltip}
            tooltipDescription={tooltipDescription}
            tooltipTitle={tooltipTitle}
          />
        </FormLabel>
        <Input
          placeholder={placeholder}
          {...field}
          type={type}
          disabled={disabled}
          autoFocus={autoFocus}
        />
        <FormMessage />
      </FormItem>
    )}
  />
);
