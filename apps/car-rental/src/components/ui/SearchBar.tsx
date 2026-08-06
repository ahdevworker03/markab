import { Search, X } from "lucide-react";
import { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SearchBarProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onClear'> {
  className?: string;
  onClear?: () => void;
}

export function SearchBar({ className, onClear, ...props }: SearchBarProps) {
  const hasValue = typeof props.value === "string" && props.value.length > 0;

  return (
    <div className={cn("relative w-full", className)}>
      <input
        type="search"
        dir="auto"
        className={cn(
          "w-full bg-muted text-foreground placeholder:text-muted-foreground rounded-xl py-2.5 border-none focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all pr-11",
          hasValue ? "pl-10" : "pl-4"
        )}
        {...props}
      />
      <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
        <Search className="w-5 h-5 text-muted-foreground" />
      </div>
      {hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="مسح البحث"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
