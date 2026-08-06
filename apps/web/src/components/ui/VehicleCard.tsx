import { Car, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { Vehicle } from "@/data/types";
import { StatusBadge } from "./StatusBadge";

interface VehicleCardProps {
  vehicle: Vehicle;
  currentRenterName?: string;
  onClick?: () => void;
  className?: string;
}

export function VehicleCard({
  vehicle,
  currentRenterName,
  onClick,
  className,
}: VehicleCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card rounded-2xl border border-card-border shadow-sm overflow-hidden",
        onClick && "cursor-pointer active:scale-[0.99] transition-transform",
        className
      )}
    >
      <div className="flex items-center gap-3 p-4">
        {/* Photo — RIGHT in RTL (first child in flex-row) */}
        <div className="w-[72px] h-[72px] rounded-xl overflow-hidden flex-shrink-0 bg-muted">
          {vehicle.photos.length > 0 ? (
            <img
              src={vehicle.photos[0]}
              alt={`${vehicle.make} ${vehicle.model}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Car className="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Row 1: Name (right) + Status (left) */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <StatusBadge status={vehicle.status} />
            <span className="text-sm font-bold text-foreground truncate">
              {vehicle.make} {vehicle.model}
            </span>
          </div>

          {/* Row 2: Plate */}
          <div className="text-xs text-muted-foreground mb-2 font-medium">
            {vehicle.plate}
          </div>

          {/* Row 3: Price (left) + Renter or year (right) */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">
              {formatCurrency(vehicle.dailyPrice)}/يوم
            </span>
            {currentRenterName ? (
              <span className="text-xs font-medium text-[hsl(var(--status-rented))] truncate">
                {currentRenterName}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">{vehicle.year}</span>
            )}
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
