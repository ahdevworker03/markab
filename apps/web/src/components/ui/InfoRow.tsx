import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InfoRowProps {
  label: string;
  value: ReactNode;
  className?: string;
}

/**
 * A label / value row used in detail pages.
 * In RTL: label appears on the RIGHT (reading start), value on the LEFT.
 */
export function InfoRow({ label, value, className }: InfoRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-3 border-b border-border last:border-0 gap-4",
        className
      )}
    >
      <div className="text-sm font-semibold text-foreground text-left flex-shrink-0">
        {value}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
