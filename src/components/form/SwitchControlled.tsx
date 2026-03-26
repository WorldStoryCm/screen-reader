"use client";

import { cn } from "@/components/component.utils";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/Form";
import type { FieldPath, FieldValues } from "react-hook-form";
import { Switch } from "../switch";

export interface SwitchControlledProps<TFieldValues extends FieldValues> {
  name: FieldPath<TFieldValues>;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const SwitchControlled = <TFieldValues extends FieldValues>({
  name,
  label,
  disabled,
  className,
}: SwitchControlledProps<TFieldValues>) => (
  <FormField
    name={name}
    render={({ field }) => (
      <FormItem className={cn("flex gap-2", className)}>
        <FormLabel className="pt-[1px]">{label}</FormLabel>
        <Switch
          checked={field.value}
          onCheckedChange={field.onChange}
          disabled={disabled}
        />
        <FormMessage />
      </FormItem>
    )}
  />
);
