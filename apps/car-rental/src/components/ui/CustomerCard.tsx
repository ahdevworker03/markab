import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatInitials } from "@/lib/format";
import type { Customer } from "@/data/types";

interface CustomerCardProps {
  customer: Customer;
  activeRentalCount: number;
  remainingBalance: number;
  onClick?: () => void;
  className?: string;
}

export function CustomerCard({
  customer,
  activeRentalCount,
  remainingBalance,
  onClick,
  className,
}: CustomerCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card rounded-2xl border border-card-border shadow-sm p-4",
        onClick && "cursor-pointer active:scale-[0.99] transition-transform",
        className
      )}
    >
      <div className="flex items-center gap-3">
        {/* Avatar — RIGHT in RTL (first child) */}
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold text-base">
          {formatInitials(customer.name)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Row 1: Name */}
          <div className="text-sm font-bold text-foreground mb-0.5">
            {customer.name}
          </div>

          {/* Row 2: Phone · Location */}
          <div className="text-xs text-muted-foreground mb-2">
            {customer.phone}
            {customer.location && (
              <span className="before:content-['·'] before:mx-1.5">
                {customer.location}
              </span>
            )}
          </div>

          {/* Row 3: Active badge + remaining balance */}
          <div className="flex items-center gap-2 flex-wrap">
            {activeRentalCount > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[hsl(var(--status-rented-bg))] text-[hsl(var(--status-rented))]">
                {activeRentalCount === 1 ? "إيجار نشط" : `${activeRentalCount} إيجارات نشطة`}
              </span>
            )}
            {remainingBalance > 0 ? (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[hsl(var(--status-danger-bg))] text-[hsl(var(--status-danger))]">
                {formatCurrency(remainingBalance)} متبقي
              </span>
            ) : activeRentalCount === 0 ? (
              <span className="text-xs text-muted-foreground">لا توجد إيجارات حالية</span>
            ) : null}
          </div>
        </div>

        {/* Chevron — LEFT in RTL (last child) */}
        <ChevronLeft
          className="w-4 h-4 text-muted-foreground flex-shrink-0"
          strokeWidth={2}
        />
      </div>
    </div>
  );
}
