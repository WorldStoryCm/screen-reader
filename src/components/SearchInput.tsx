import { Input } from "@/components/input";
import { cn } from "@/components/component.utils";
import { DeleteIcon, SearchIcon } from "lucide-react";
import { type InputHTMLAttributes, forwardRef } from "react";

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  clearValue?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, className, clearValue, ...props }, ref) => (
    <Input
      value={value}
      ref={ref}
      className={cn(
        "rounded-full focus-visible:ring-0 focus-visible:ring-offset-0",
        className
      )}
      translate="no"
      placeholder="Search..."
      autoComplete="off"
      startAddon={<SearchIcon className="h-4 w-4" />}
      type="text"
      endAddon={
        value && `${value}`.length ? (
          <DeleteIcon className="h-4 w-4 cursor-pointer" onClick={clearValue} />
        ) : null
      }
      {...props}
    />
  )
);

SearchInput.displayName = "SearchInput";
