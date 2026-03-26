"use client";

import { FormField, FormItem, FormLabel, FormMessage } from "@/components/Form";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { Textarea } from "../textarea";
import { InfoIconTooltip, InfoTooltipProps } from "./InfoIconTooltip";

export interface TextAreaControlledProps<
  TFieldValues extends FieldValues,
> extends InfoTooltipProps {
  control?: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  rows?: number;
}

export const TextAreaControlled = <TFieldValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  disabled,
  maxLength,
  rows,
  tooltip,
  tooltipTitle,
  tooltipDescription,
}: TextAreaControlledProps<TFieldValues>) => (
  <FormField
    disabled={disabled}
    control={control}
    name={name}
    render={({ field }) => (
      <FormItem>
        <FormLabel className="flex items-center gap-1">
          {label}
          <InfoIconTooltip
            tooltip={tooltip}
            tooltipDescription={tooltipDescription}
            tooltipTitle={tooltipTitle}
          />
        </FormLabel>
        <Textarea
          rows={rows}
          placeholder={placeholder}
          maxLength={maxLength}
          {...field}
        />
        <FormMessage />
      </FormItem>
    )}
  />
);
