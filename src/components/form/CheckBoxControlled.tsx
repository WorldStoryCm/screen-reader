"use client";

import { Checkbox } from "@/components/checkbox";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/Form";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

export interface CheckBoxControlledProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label?: string;
  disabled?: boolean;
}

export const CheckBoxControlled = <TFieldValues extends FieldValues>({
  control,
  name,
  label,
  disabled,
}: CheckBoxControlledProps<TFieldValues>) => (
  <FormField
    disabled={disabled}
    control={control}
    name={name}
    render={({ field }) => (
      <FormItem className="flex flex-row items-start space-y-0 space-x-2 py-1">
        <FormControl>
          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
        </FormControl>
        <FormLabel className="cursor-pointer pt-0.5">{label}</FormLabel>
      </FormItem>
    )}
  />
);
