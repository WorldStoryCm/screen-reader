"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Globe, Search } from "lucide-react";
import { Button } from "@/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/Popover";
import { Input } from "@/components/input";
import { ScrollArea } from "@/components/scroll-area";
import { cn } from "@/components/component.utils";

interface TimezoneOption {
  value: string;
  label: string;
  offset: number;
}

function getTimezoneOffset(tz: string): number {
  try {
    const now = new Date();
    const utcDate = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    const tzDate = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60);
  } catch {
    return 0;
  }
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(minutes);
  const hours = Math.floor(absMinutes / 60);
  const mins = absMinutes % 60;
  return `GMT${sign}${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function getTimezoneOptions(): TimezoneOption[] {
  const timezones = Intl.supportedValuesOf("timeZone");

  const options = timezones.map((tz) => {
    const offset = getTimezoneOffset(tz);
    return {
      value: tz,
      label: `(${formatOffset(offset)}) ${tz.replace(/_/g, " ")}`,
      offset,
    };
  });

  return options.sort((a, b) => a.offset - b.offset);
}

const TIMEZONE_OPTIONS = getTimezoneOptions();

function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

interface TimezoneSelectProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TimezoneSelect({
  value,
  onChange,
  placeholder = "Select timezone...",
  disabled,
}: TimezoneSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const browserTz = React.useMemo(() => getBrowserTimezone(), []);

  const filteredOptions = React.useMemo(() => {
    if (!search) return TIMEZONE_OPTIONS;
    const searchLower = search.toLowerCase();
    return TIMEZONE_OPTIONS.filter(
      (tz) =>
        tz.value.toLowerCase().includes(searchLower) ||
        tz.label.toLowerCase().includes(searchLower)
    );
  }, [search]);

  const selectedOption = TIMEZONE_OPTIONS.find((tz) => tz.value === value);

  const handleDetectTimezone = () => {
    onChange(browserTz);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 border-b p-2">
            <Search className="text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search timezones..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="m-2 justify-start gap-2"
            onClick={handleDetectTimezone}
          >
            <Globe className="h-4 w-4" />
            Use browser timezone ({browserTz})
          </Button>

          <ScrollArea className="h-[300px]">
            <div className="p-2">
              {filteredOptions.length === 0 ? (
                <div className="text-muted-foreground py-6 text-center text-sm">
                  No timezone found.
                </div>
              ) : (
                filteredOptions.map((tz) => (
                  <Button
                    key={tz.value}
                    variant="ghost"
                    className="w-full justify-start font-normal"
                    onClick={() => {
                      onChange(tz.value);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === tz.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {tz.label}
                  </Button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
