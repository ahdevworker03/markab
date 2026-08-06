import { useLocation } from "wouter";
import { Car, Wrench, ChevronLeft, Calendar, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { InfoRow } from "@/components/ui/InfoRow";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { MAINTENANCE_TYPES } from "@/lib/labels";
import { formatCurrency, formatDateAr } from "@/lib/format";
import { useVehicle } from "@/features/vehicles/hooks";
import { useCustomer } from "@/features/customers/hooks";
import { useRentalsForVehicle, useTotalRemaining } from "@/features/rentals/hooks";
import { useMaintenanceForVehicle } from "@/features/maintenance/hooks";
import type { MaintenanceType } from "@/data/types";

// ─── Component ────────────────────────────────────────────────────────────────
export default function VehicleDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [, setLocation] = useLocation();
  const getVehicleById = useVehicle;
  const getCustomerById = useCustomer;
  const getRentalsForVehicle = useRentalsForVehicle;
  const getMaintenanceForVehicle = useMaintenanceForVehicle;
  const getTotalRemaining = useTotalRemaining;
  const vehicle = getVehicleById(params.id);

  if (!vehicle) {
    return (
      <div className="min-h-full">
        <PageHeader title="السيارة غير موجودة" showBack />
        <div className="flex flex-col items-center justify-center py-24 gap-4 px-6 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-muted-foreground text-sm">لم يتم العثور على هذه السيارة</p>
          <button
            onClick={() => setLocation("/vehicles")}
            className="text-primary font-medium text-sm active:opacity-70"
          >
            العودة إلى السيارات
          </button>
        </div>
      </div>
    );
  }

  const allRentals = getRentalsForVehicle(vehicle.id);
  const activeRental = allRentals.find((r) => r.status === "active");
  const pastRentals = allRentals.filter((r) => r.status === "ended");
  const maintenanceRecords = getMaintenanceForVehicle(vehicle.id);
  const renter = activeRental ? getCustomerById(activeRental.customerId) : null;
  const remaining = activeRental ? getTotalRemaining(activeRental.id) : 0;

  return (
    <div className="min-h-full pb-6">
      <PageHeader
        title={`${vehicle.make} ${vehicle.model}`}
        showBack
        action={
          <button
            onClick={() => setLocation(`/vehicles/add?edit=${vehicle.id}`)}
            className="text-sm font-semibold text-primary px-3 py-1.5 rounded-lg active:bg-muted/50 transition-colors"
          >
            تعديل
          </button>
        }
      />

      {/* ── Photo ──────────────────────────────────────────────────────── */}
      <div className="relative w-full aspect-video bg-muted overflow-hidden">
        {vehicle.photos.length > 0 ? (
          <img
            src={vehicle.photos[0]}
            alt={`${vehicle.make} ${vehicle.model}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Car className="w-12 h-12 text-muted-foreground" strokeWidth={1} />
            <span className="text-xs text-muted-foreground">لا توجد صورة</span>
          </div>
        )}
        <div className="absolute bottom-3 right-3">
          <StatusBadge status={vehicle.status} className="text-xs px-3 py-1 shadow-sm" />
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5">

        {/* ── Vehicle Info ───────────────────────────────────────────────── */}
        <div className="bg-card rounded-2xl border border-card-border shadow-sm px-4">
          <InfoRow label="رقم اللوحة" value={vehicle.plate} />
          <InfoRow label="السنة" value={vehicle.year} />
          <InfoRow
            label="المسافة المقطوعة"
            value={`${new Intl.NumberFormat("en-US").format(vehicle.mileage)} كم`}
          />
          <InfoRow label="الأجرة اليومية" value={formatCurrency(vehicle.dailyPrice)} />
          {vehicle.notes && (
            <InfoRow label="ملاحظات" value={vehicle.notes} />
          )}
        </div>

        {/* ── Current Rental ─────────────────────────────────────────────── */}
        {activeRental && renter && (
          <div>
            <h2 className="text-sm font-bold text-foreground mb-2 px-1">الإيجار الحالي</h2>
            <div
              onClick={() => setLocation(`/rentals/${activeRental.id}`)}
              className="bg-card rounded-2xl border border-[hsl(var(--status-rented-bg))] shadow-sm p-4 cursor-pointer active:scale-[0.99] transition-transform"
            >
              <div className="flex items-start justify-between mb-3">
                <ChevronLeft className="w-4 h-4 text-muted-foreground mt-0.5" strokeWidth={2} />
                <span className="text-base font-bold text-foreground">{renter.name}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Calendar className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>
                  {formatDateAr(activeRental.startDate)} — {formatDateAr(activeRental.endDate)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <span
                  className={
                    remaining > 0
                      ? "text-sm font-bold text-[hsl(var(--status-danger))]"
                      : "text-sm font-bold text-[hsl(var(--status-available))]"
                  }
                >
                  {remaining > 0 ? `${formatCurrency(remaining)} متبقي` : "مدفوع بالكامل"}
                </span>
                <span className="text-xs text-muted-foreground">
                  إجمالي {formatCurrency(activeRental.totalAmount)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Action Buttons ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {vehicle.status === "rented" ? (
            <>
              <button
                onClick={() => setLocation(`/rentals/${activeRental?.id}`)}
                className="flex items-center justify-center gap-2 bg-[hsl(var(--status-danger-bg))] text-[hsl(var(--status-danger))] rounded-2xl py-3.5 font-semibold text-sm active:scale-95 transition-transform"
              >
                إعادة السيارة
              </button>
              <button
                onClick={() => setLocation(`/maintenance/add?vehicle=${vehicle.id}`)}
                className="flex items-center justify-center gap-2 bg-card border border-card-border rounded-2xl py-3.5 font-semibold text-sm text-foreground active:scale-95 transition-transform"
              >
                <Wrench className="w-4 h-4" strokeWidth={1.75} />
                تسجيل صيانة
              </button>
            </>
          ) : vehicle.status === "available" ? (
            <>
              <button
                onClick={() => setLocation(`/rentals/new?vehicle=${vehicle.id}`)}
                className="flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold text-sm active:scale-95 transition-transform"
              >
                تأجير السيارة
              </button>
              <button
                onClick={() => setLocation(`/maintenance/add?vehicle=${vehicle.id}`)}
                className="flex items-center justify-center gap-2 bg-card border border-card-border rounded-2xl py-3.5 font-semibold text-sm text-foreground active:scale-95 transition-transform"
              >
                <Wrench className="w-4 h-4" strokeWidth={1.75} />
                تسجيل صيانة
              </button>
            </>
          ) : (
            /* maintenance status */
            <button
              onClick={() => setLocation(`/maintenance/add?vehicle=${vehicle.id}`)}
              className="col-span-2 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold text-sm active:scale-95 transition-transform"
            >
              <Wrench className="w-4 h-4" strokeWidth={1.75} />
              تسجيل صيانة
            </button>
          )}
        </div>

        {/* ── Rental History ─────────────────────────────────────────────── */}
        <CollapsibleSection
          title="الإيجارات السابقة"
          count={pastRentals.length}
        >
          {pastRentals.length === 0 ? (
            <div className="px-4 py-5 text-sm text-muted-foreground text-center">
              لا توجد إيجارات سابقة
            </div>
          ) : (
            pastRentals.map((rental) => {
              const customer = getCustomerById(rental.customerId);
              return (
                <div
                  key={rental.id}
                  onClick={() => setLocation(`/rentals/${rental.id}`)}
                  className="flex items-start justify-between px-4 py-3.5 border-b border-border last:border-0 cursor-pointer active:bg-muted/50"
                >
                  <div className="text-left">
                    <div className="text-sm font-semibold text-foreground">
                      {formatCurrency(rental.totalAmount)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatDateAr(rental.endDate)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">
                      {customer?.name ?? "—"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatDateAr(rental.startDate)} — {formatDateAr(rental.endDate)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CollapsibleSection>

        {/* ── Maintenance History ────────────────────────────────────────── */}
        <CollapsibleSection
          title="سجل الصيانة"
          count={maintenanceRecords.length}
        >
          {maintenanceRecords.length === 0 ? (
            <div className="px-4 py-5 text-sm text-muted-foreground text-center">
              لا توجد سجلات صيانة
            </div>
          ) : (
            maintenanceRecords.map((record) => (
              <div
                key={record.id}
                className="flex items-start justify-between px-4 py-3.5 border-b border-border last:border-0"
              >
                <div className="text-left">
                  <StatusBadge status={record.status} />
                  {record.cost && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatCurrency(record.cost)}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-foreground">
                    {MAINTENANCE_TYPES[record.type as MaintenanceType]?.label ?? record.type}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatDateAr(record.dueDate)}
                  </div>
                  {record.notes && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {record.notes}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </CollapsibleSection>

      </div>
    </div>
  );
}
