"use client";

import {Button} from "@/components/button";
import {ComponentProps} from "react";
import {cn} from "./component.utils";

export interface SegmentedOption<T = string | number | boolean> {
    value: T;
    label: string;
    disabled?: boolean;
}

interface Props<T = string | number | boolean> extends Omit<
    ComponentProps<"div">,
    "onChange"
> {
    options: SegmentedOption<T>[];
    value: T | undefined;
    onChange: (value: T) => void;
    disabled?: boolean;
}

export function SegmentedControl<T = string | number | boolean>({
                                                                    options,
                                                                    value,
                                                                    onChange,
                                                                    disabled,
                                                                    className,
                                                                }: Props<T>) {
    return (
        <div
            className={cn(
                "inline-flex h-8 overflow-hidden rounded-lg",
                "bg-muted ring-1 ring-border ring-inset",
                "p-0.5", // <-- ключ: даёт "рамку" вокруг выбранного сегмента
                disabled && "pointer-events-none opacity-50",
                className
            )}
            role="group"
        >
            {options.map((opt, idx) => {
                const isSelected = opt.value === value;

                return (
                    <Button
                        key={String(opt.value)}
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-pressed={isSelected}
                        disabled={disabled || opt.disabled}
                        className={cn(
                            "h-7 min-w-[96px] rounded-md px-4 text-sm",
                            "focus-visible:ring-0",
                            // divider — только между сегментами (и мягкий)
                            idx !== 0 && "ml-0.5",

                            // states
                            isSelected
                                ? "bg-white text-emerald-600 shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
                                : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
                        )}
                        onClick={() => onChange(opt.value)}
                    >
                        {opt.label}
                    </Button>
                );
            })}
        </div>
    );
}

export default SegmentedControl;
