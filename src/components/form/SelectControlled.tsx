"use client";

import { cn } from "@/components/component.utils";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/Form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/select";
import type { FieldPath, FieldValues } from "react-hook-form";
import { InfoIconTooltip, InfoTooltipProps } from "./InfoIconTooltip";
import { Typography } from "../Typography";

export type SelectOption<T = string, A = Record<string, string>> = {
  value: T;
  label: string;
  isDisabled?: boolean;
  children?: SelectOption<T>[];
  level?: number;
  additionalDetails?: A;
};

// ...

export interface DropdownControlledProps<
  TFieldValues extends FieldValues,
  TItems extends SelectOption,
> extends InfoTooltipProps {
  name: FieldPath<TFieldValues>;
  label?: string;
  subLabel?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  items: TItems[];
  disabled?: boolean;
  className?: string;
}

export const SelectControlled = <
  TFieldValues extends FieldValues,
  TItems extends SelectOption,
>({
  name,
  label,
  subLabel,
  onChange,
  placeholder,
  items,
  disabled,
  className,
  tooltip,
  tooltipTitle,
  tooltipDescription,
}: DropdownControlledProps<TFieldValues, TItems>) => (
  <FormField
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
          {subLabel && (
            <Typography variant="extraSmall" className="text-muted-foreground">
              {subLabel}
            </Typography>
          )}
        </FormLabel>
        <Select
          disabled={disabled}
          onValueChange={(value) => {
            field.onChange(value);
            onChange?.(value);
          }}
          value={field.value}
        >
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {items.map((item) => (
              <SelectItem
                key={String(item.value)}
                value={String(item.value)}
                disabled={item.isDisabled}
              >
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )}
  />
);
