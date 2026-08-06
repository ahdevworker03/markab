import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Car,
  Calendar,
  Banknote,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDateAr } from "@/lib/format";
import { MAINTENANCE_TYPES } from "@/lib/labels";
import { daysFromToday } from "@/lib/mock-date";
import type { MaintenanceRecord } from "@/data/types";

// ── Status colours ────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  overdue: {
    iconBg:   "bg-[hsl(var(--status-danger-bg))]",
    iconText: "text-[hsl(var(--status-danger))]",
    badge:    "bg-[hsl(var(--status-danger-bg))] text-[hsl(var(--status-danger))]",
    days:     "text-[hsl(var(--status-danger))]",
    border:   "border-[hsl(var(--status-danger))]/20",
  },
  upcoming: {
    iconBg:   "bg-[hsl(var(--status-maintenance-bg))]",
    iconText: "text-[hsl(var(--status-maintenance))]",
    badge:    "bg-[hsl(var(--status-maintenance-bg))] text-[hsl(var(--status-maintenance))]",
    days:     "text-[hsl(var(--status-maintenance))]",
    border:   "border-card-border",
  },
  completed: {
    iconBg:   "bg-[hsl(var(--status-available-bg))]",
    iconText: "text-[hsl(var(--status-available))]",
    badge:    "bg-[hsl(var(--status-available-bg))] text-[hsl(var(--status-available))]",
    days:     "text-[hsl(var(--status-available))]",
    border:   "border-card-border",
  },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface MaintenanceCardProps {
  record: MaintenanceRecord;
  vehicleName: string;
  vehiclePlate: string;
  isExpanded: boolean;
  onToggle: () => void;
  onMarkComplete: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MaintenanceCard({
  record,
  vehicleName,
  vehiclePlate,
  isExpanded,
  onToggle,
  onMarkComplete,
}: MaintenanceCardProps) {
  const typeConfig = MAINTENANCE_TYPES[record.type];
  const TypeIcon = typeConfig.icon;
  const styles = STATUS_STYLES[record.status];
  const days = daysFromToday(record.dueDate);

  const daysLabel =
    record.status === "completed"
      ? null
      : days < 0
      ? `متأخر ${Math.abs(days)} يوم`
      : days === 0
      ? "اليوم"
      : `بعد ${days} يوم`;

  return (
    <div
      className={cn(
        "bg-card rounded-2xl border shadow-sm overflow-hidden transition-all",
        styles.border
      )}
    >
      {/* ── Collapsed row ─────────────────────────────────────────── */}
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={`maintenance-detail-${record.id}`}
        className="w-full flex items-center gap-3 p-4 text-right"
      >
        {/* Type icon — RIGHT in RTL */}
        <div
          className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
            styles.iconBg
          )}
        >
          <TypeIcon className={cn("w-5 h-5", styles.iconText)} strokeWidth={1.8} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            {/* Days / status label — LEFT */}
            {daysLabel && (
              <span className={cn("text-xs font-bold flex-shrink-0", styles.days)}>
                {daysLabel}
              </span>
            )}
            {record.status === "completed" && (
              <CheckCircle
                className="w-4 h-4 text-[hsl(var(--status-available))] flex-shrink-0"
                strokeWidth={2}
              />
            )}
            {/* Vehicle name — RIGHT */}
            <span className="text-sm font-bold text-foreground truncate">
              {vehicleName}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            {/* Date — LEFT */}
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatDateAr(record.dueDate)}
            </span>
            {/* Type label — RIGHT */}
            <span
              className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full",
                styles.badge
              )}
            >
              {typeConfig.label}
            </span>
          </div>
        </div>

        {/* Chevron toggle — LEFT */}
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={2} />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={2} />
        )}
      </button>

      {/* ── Expanded detail ───────────────────────────────────────── */}
      {isExpanded && (
        <div
          id={`maintenance-detail-${record.id}`}
          role="region"
          className="border-t border-border px-4 pt-3 pb-4 space-y-3"
        >
          {/* Vehicle */}
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Car className="w-3.5 h-3.5" strokeWidth={1.5} />
              {vehiclePlate}
            </span>
            <span className="text-sm font-semibold text-foreground">{vehicleName}</span>
          </div>

          {/* Due date */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
              {formatDateAr(record.dueDate)}
            </span>
            <span className="text-sm text-muted-foreground">تاريخ الاستحقاق</span>
          </div>

          {/* Completion date */}
          {record.completedDate && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[hsl(var(--status-available))]">
                {formatDateAr(record.completedDate)}
              </span>
              <span className="text-sm text-muted-foreground">تاريخ الإنجاز</span>
            </div>
          )}

          {/* Cost */}
          {record.cost !== undefined && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Banknote className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                {formatCurrency(record.cost)}
              </span>
              <span className="text-sm text-muted-foreground">التكلفة</span>
            </div>
          )}

          {/* Notes */}
          {record.notes && (
            <div className="flex items-start justify-between gap-4">
              <span className="text-sm text-foreground text-left flex-1">
                {record.notes}
              </span>
              <span className="flex items-center gap-1 text-sm text-muted-foreground flex-shrink-0">
                <StickyNote className="w-3.5 h-3.5" strokeWidth={1.5} />
                ملاحظات
              </span>
            </div>
          )}

          {/* Action — only for active/overdue */}
          {record.status !== "completed" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkComplete();
              }}
              className="w-full flex items-center justify-center gap-2 bg-[hsl(var(--status-available))] text-white rounded-xl py-3 text-sm font-bold active:scale-[0.98] transition-transform mt-1"
            >
              <CheckCircle className="w-4 h-4" strokeWidth={2.5} />
              تم الإنجاز
            </button>
          )}
        </div>
      )}
    </div>
  );
}
