import { useState, ReactNode, useId } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function CollapsibleSection({
  title,
  count,
  children,
  defaultOpen = false,
  className,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const id = useId();
  const contentId = `collapsible-section-${id}`;

  return (
    <div
      className={cn(
        "bg-card rounded-2xl border border-card-border overflow-hidden",
        className
      )}
    >
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="w-full flex items-center justify-between p-4"
      >
        {/* In RTL: title is RIGHT (first), chevron is LEFT (last) */}
        <div className="flex items-center gap-2">
          {/* In RTL this div is on the LEFT since it's last */}
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" strokeWidth={2.5} />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" strokeWidth={2.5} />
          )}
          {count !== undefined && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
              {count}
            </span>
          )}
        </div>
        <span className="text-sm font-bold text-foreground">{title}</span>
      </button>

      <div id={contentId} role="region" className={cn(!isOpen && "hidden")}>
        {isOpen && <div className="border-t border-border">{children}</div>}
      </div>
    </div>
  );
}
