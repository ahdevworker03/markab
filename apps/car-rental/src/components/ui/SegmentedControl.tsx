import { useRef } from "react";
import { cn } from "@/lib/utils";

interface SegmentedControlProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SegmentedControl({ options, value, onChange, className }: SegmentedControlProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const moveFocus = (currentIndex: number, key: string) => {
    // In an RTL layout ArrowLeft moves forward through the options and ArrowRight moves backward
    let nextIndex: number;
    if (key === "ArrowLeft") nextIndex = (currentIndex + 1) % options.length;
    else if (key === "ArrowRight") nextIndex = (currentIndex - 1 + options.length) % options.length;
    else if (key === "Home") nextIndex = 0;
    else if (key === "End") nextIndex = options.length - 1;
    else return;

    onChange(options[nextIndex].value);
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[nextIndex]?.focus();
  };

  return (
    <div ref={listRef} role="tablist" className={cn("flex w-full bg-muted p-1 rounded-xl", className)}>
      {options.map((option, index) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                moveFocus(index, e.key);
              }
            }}
            className={cn(
              "flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all duration-200",
              isActive 
                ? "bg-white text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground hover:bg-white/50"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
