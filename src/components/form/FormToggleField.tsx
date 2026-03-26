"use client";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/Form";
import { Label } from "@/components/label";
import {
  SegmentedControl,
  SegmentedOption,
} from "@/components/SegmentedControl";
import { ReactNode } from "react";
import { cn } from "@/components/component.utils";
import { Control, FieldPath, FieldValues } from "react-hook-form";
import { InfoIconTooltip, InfoTooltipProps } from "./InfoIconTooltip";

interface Props<
  TFieldValues extends FieldValues,
  TValue = string | number | boolean,
> extends InfoTooltipProps {
  name: FieldPath<TFieldValues>;
  control?: Control<TFieldValues>;
  title: string | ReactNode;
  className?: string;
  labelClassName?: string;
  disabled?: boolean;
  showErrorMessage?: boolean;
  options: SegmentedOption<TValue>[];
}

export function FormToggleField<
  TFieldValues extends FieldValues,
  TValue = string | number | boolean,
>({
  title,
  name,
  control,
  className,
  disabled,
  labelClassName,
  showErrorMessage = true,
  options,
  tooltip,
  tooltipTitle,
  tooltipDescription,
}: Props<TFieldValues, TValue>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <div>
            <FormLabel
              className={cn("flex items-center gap-1", labelClassName)}
            >
              {typeof title === "string" ? (
                <Label htmlFor={name} className="mt-0">
                  {title}
                </Label>
              ) : (
                <>{title}</>
              )}
              <InfoIconTooltip
                tooltip={tooltip}
                tooltipDescription={tooltipDescription}
                tooltipTitle={tooltipTitle}
              />
            </FormLabel>
          </div>
          <FormControl>
            <SegmentedControl
              className={className}
              disabled={disabled}
              value={field.value}
              onChange={(val) => {
                field.onChange(val);
                field.onBlur();
              }}
              options={options}
            />
          </FormControl>
          {showErrorMessage && <FormMessage />}
        </FormItem>
      )}
    />
  );
}
