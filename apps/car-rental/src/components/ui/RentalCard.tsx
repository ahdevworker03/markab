import { Car, Calendar, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDateShort } from "@/lib/format";
import type { Rental } from "@/data/types";

interface RentalCardProps {
  rental: Rental;
  customerName: string;
  vehicleName: string;
  vehiclePlate: string;
  onClick?: () => void;
  className?: string;
}

function getTotalPaid(rental: Rental) {
  return rental.payments.reduce((s, p) => s + p.amount, 0);
}

export function RentalCard({
  rental,
  customerName,
  vehicleName,
  vehiclePlate,
  onClick,
  className,
}: RentalCardProps) {
  const paid = getTotalPaid(rental);
  const remaining = Math.max(0, rental.totalAmount - paid);
  const isActive = rental.status === "active";

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card rounded-2xl border border-card-border shadow-sm p-4",
        onClick && "cursor-pointer active:scale-[0.99] transition-transform",
        className
      )}
    >
      {/* Row 1: Name (right) + Status badge (left) */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={cn(
            "text-xs font-semibold px-2.5 py-0.5 rounded-full",
            isActive
              ? "bg-[hsl(var(--status-rented-bg))] text-[hsl(var(--status-rented))]"
              : "bg-[hsl(var(--status-available-bg))] text-[hsl(var(--status-available))]"
          )}
        >
          {isActive ? "نشط" : "منتهي"}
        </span>
        <span className="text-base font-bold text-foreground">{customerName}</span>
      </div>

      {/* Row 2: Vehicle */}
      <div className="flex items-center justify-end gap-1.5 mb-2">
        <span className="text-xs text-muted-foreground">{vehiclePlate}</span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-sm font-medium text-foreground">{vehicleName}</span>
        <Car className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
      </div>

      {/* Row 3: Date range — RTL order: startDate right (first), endDate left (last) */}
      <div className="flex items-center justify-end gap-1.5 mb-3">
        <span className="text-xs text-muted-foreground">{formatDateShort(rental.endDate)}</span>
        <span className="text-xs text-muted-foreground">—</span>
        <span className="text-xs text-muted-foreground">{formatDateShort(rental.startDate)}</span>
        <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
      </div>

      {/* Row 4: Financial + chevron */}
      <div className="flex items-center justify-between border-t border-border pt-2.5 gap-2">
        <ChevronLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={2} />
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {remaining > 0 ? (
            <span className="text-sm font-bold text-[hsl(var(--status-danger))]">
              {formatCurrency(remaining)} متبقي
            </span>
          ) : (
            <span className="text-xs font-semibold text-[hsl(var(--status-available))]">
              مدفوع بالكامل
            </span>
          )}
          <span className="text-sm font-semibold text-foreground">
            {formatCurrency(rental.totalAmount)}
          </span>
        </div>
      </div>
    </div>
  );
}
