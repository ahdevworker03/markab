import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Phone,
  Car,
  Calendar,
  CreditCard,
  CheckCircle,
  RotateCcw,
  X,
  AlertCircle,
  FileEdit,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { InfoRow } from "@/components/ui/InfoRow";
import { formatCurrency, formatDateAr } from "@/lib/format";
import { MOCK_TODAY, MOCK_TODAY_STR as MOCK_TODAY_DATE } from "@/lib/mock-date";
import { useTimeout } from "@/hooks/useTimeout";
import { useRentals } from "@/features/rentals/hooks";
import { useVehicles, useVehicleById } from "@/features/vehicles/hooks";
import { useCustomer } from "@/features/customers/hooks";
import { getTotalPaid, getRemaining } from "@/features/rentals/selectors";
import type { Rental, Payment } from "@/data/types";

function daysBetween(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

interface Props {
  params: { id: string };
}

export default function RentalDetailPage({ params }: Props) {
  const [, setLocation] = useLocation();
  const rentals = useRentals();
  const vehicles = useVehicles();
  const getCustomerById = useCustomer;
  const getVehicleById = useVehicleById();

  const [rental, setRental] = useState<Rental | null>(() => {
    return rentals.find((r) => r.id === params.id) ?? null;
  });

  const [showPaymentInput, setShowPaymentInput] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentError, setPaymentError] = useState("");

  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [returnDate, setReturnDate] = useState(MOCK_TODAY_DATE);

  const [successMsg, setSuccessMsg] = useState("");

  // Re-sync when the route param changes (component instance is reused across /rentals/:id)
  useEffect(() => {
    setRental(rentals.find((r) => r.id === params.id) ?? null);
  }, [params.id]);

  // Auto-clear the success banner, cleaned up on unmount
  useTimeout(() => setSuccessMsg(""), successMsg ? 2500 : null);

  if (!rental) {
    return (
      <div className="min-h-full">
        <PageHeader title="تفاصيل الإيجار" showBack />
        <div className="flex flex-col items-center justify-center py-24 gap-4 px-6 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-muted-foreground text-sm">لم يتم العثور على الإيجار</p>
          <button
            onClick={() => setLocation("/rentals")}
            className="text-primary font-medium text-sm active:opacity-70"
          >
            العودة إلى الإيجارات
          </button>
        </div>
      </div>
    );
  }

  const customer = getCustomerById(rental.customerId);
  const vehicleList = rental.vehicleIds
    .map(getVehicleById)
    .filter(Boolean) as ReturnType<typeof getVehicleById>[];

  const primaryVehicle = vehicleList[0];

  const paid = getTotalPaid(rental);
  const remaining = getRemaining(rental);
  const paidPercent = Math.min(
    100,
    rental.totalAmount > 0 ? Math.round((paid / rental.totalAmount) * 100) : 0
  );
  const days = daysBetween(rental.startDate, rental.endDate);
  const isActive = rental.status === "active";

  function syncRental(updated: Rental) {
    setRental(updated);
    const idx = rentals.findIndex((r) => r.id === updated.id);
    if (idx !== -1) rentals[idx] = updated;
  }

  function handleAddPayment() {
    const amount = parseInt(paymentAmount.replace(/,/g, ""), 10);
    if (!amount || amount <= 0) {
      setPaymentError("أدخل مبلغاً صحيحاً");
      return;
    }
    if (amount > remaining) {
      setPaymentError("المبلغ أكبر من الرصيد المتبقي");
      return;
    }
    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      amount,
      date: MOCK_TODAY.toISOString(),
    };
    const updated: Rental = {
      ...rental!,
      payments: [...rental!.payments, newPayment],
    };
    syncRental(updated);
    setPaymentAmount("");
    setPaymentError("");
    setShowPaymentInput(false);
    setSuccessMsg("تم تسجيل الدفعة");
  }

  function handleReturn() {
    const updated: Rental = {
      ...rental!,
      status: "ended",
      returnDate: new Date(returnDate + "T12:00:00Z").toISOString(),
    };
    syncRental(updated);
    rental!.vehicleIds.forEach((vid) => {
      const vIdx = vehicles.findIndex((v) => v.id === vid);
      if (vIdx !== -1) {
        vehicles[vIdx] = { ...vehicles[vIdx], status: "available" };
      }
    });
    setShowReturnConfirm(false);
    setSuccessMsg("تم إعادة السيارة بنجاح");
  }

  return (
    <div className="min-h-full">
      <PageHeader title="تفاصيل الإيجار" showBack />

      {/* Success toast — consistent with MaintenancePage */}
      {successMsg && (
        <div className="mx-4 mt-3 px-4 py-3 rounded-xl bg-[hsl(var(--status-available-bg))] text-[hsl(var(--status-available))] text-sm font-semibold flex items-center gap-2 justify-end">
          <span>{successMsg}</span>
          <CheckCircle className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
        </div>
      )}

      <div className="px-4 pt-4 pb-6 space-y-4">
        {/* Status banner */}
        <div
          className={`rounded-2xl px-4 py-3 flex items-center justify-between ${
            isActive
              ? "bg-[hsl(var(--status-rented-bg))]"
              : "bg-[hsl(var(--status-available-bg))]"
          }`}
        >
          <span
            className={`text-sm font-bold ${
              isActive
                ? "text-[hsl(var(--status-rented))]"
                : "text-[hsl(var(--status-available))]"
            }`}
          >
            {isActive ? "إيجار نشط" : "إيجار منتهي"}
          </span>
          {rental.returnDate && (
            <span className="text-xs text-muted-foreground">
              أُعيدت: {formatDateAr(rental.returnDate)}
            </span>
          )}
        </div>

        {/* Customer card */}
        <div className="bg-card rounded-2xl border border-card-border shadow-sm p-4">
          <div className="text-xs font-semibold text-muted-foreground mb-3 text-right">
            العميل
          </div>
          <div className="flex items-center justify-between gap-3">
            <a
              href={`tel:${customer?.phone}`}
              onClick={(e) => e.preventDefault()}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary flex-shrink-0"
              aria-label="اتصال"
            >
              <Phone className="w-4 h-4" strokeWidth={2} />
            </a>
            <div className="text-right flex-1">
              <button
                onClick={() => customer && setLocation(`/customers/${customer.id}`)}
                className="text-base font-bold text-foreground hover:text-primary active:text-primary/80 transition-colors"
              >
                {customer?.name ?? "—"}
              </button>
              <div className="text-sm text-muted-foreground">
                {customer?.phone}
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle card */}
        <div className="bg-card rounded-2xl border border-card-border shadow-sm p-4">
          <div className="text-xs font-semibold text-muted-foreground mb-3 text-right">
            السيارة
          </div>
          {vehicleList.map((v) =>
            v ? (
              <div
                key={v.id}
                className="flex items-center justify-between gap-3"
              >
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                  {v.photos.length > 0 ? (
                    <img
                      src={v.photos[0]}
                      alt={`${v.make} ${v.model}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Car
                        className="w-6 h-6 text-muted-foreground"
                        strokeWidth={1.5}
                      />
                    </div>
                  )}
                </div>
                <div className="text-right flex-1">
                  <button
                    onClick={() => setLocation(`/vehicles/${v.id}`)}
                    className="text-base font-bold text-foreground hover:text-primary active:text-primary/80 transition-colors"
                  >
                    {v.make} {v.model}
                  </button>
                  <div className="text-sm text-muted-foreground">{v.plate}</div>
                </div>
              </div>
            ) : null
          )}
        </div>

        {/* Rental info */}
        <div className="bg-card rounded-2xl border border-card-border shadow-sm px-4 py-2">
          <InfoRow
            label="تاريخ البداية"
            value={
              <span className="flex items-center gap-1.5">
                {formatDateAr(rental.startDate)}
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
              </span>
            }
          />
          <InfoRow
            label="تاريخ الانتهاء"
            value={
              <span className="flex items-center gap-1.5">
                {formatDateAr(rental.endDate)}
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
              </span>
            }
          />
          <InfoRow label="عدد الأيام" value={`${days} يوم`} />
          <InfoRow
            label="الأجرة اليومية"
            value={
              primaryVehicle
                ? formatCurrency(rental.dailyPrices[primaryVehicle.id] ?? 0)
                : "—"
            }
          />
          <InfoRow
            label="الإجمالي"
            value={
              <span className="font-bold text-foreground">
                {formatCurrency(rental.totalAmount)}
              </span>
            }
          />
          {rental.notes && <InfoRow label="ملاحظات" value={rental.notes} />}
        </div>

        {/* Payment summary */}
        <div className="bg-card rounded-2xl border border-card-border shadow-sm p-4">
          <div className="text-sm font-bold text-foreground mb-3 text-right">
            الدفعات
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-[hsl(var(--status-available))] rounded-full transition-all duration-500"
                style={{ width: `${paidPercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
              <span className="text-[hsl(var(--status-available))] font-semibold">
                {paidPercent}% مدفوع
              </span>
              <span>
                {formatCurrency(paid)} من {formatCurrency(rental.totalAmount)}
              </span>
            </div>
          </div>

          {/* Remaining */}
          {remaining > 0 && (
            <div className="flex justify-between items-center py-2 border-t border-border mb-2">
              <span className="text-base font-bold text-[hsl(var(--status-danger))]">
                {formatCurrency(remaining)}
              </span>
              <span className="text-sm font-semibold text-[hsl(var(--status-danger))]">
                الرصيد المتبقي
              </span>
            </div>
          )}

          {/* Payment history */}
          {rental.payments.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {rental.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                >
                  <span className="text-sm font-semibold text-[hsl(var(--status-available))]">
                    {formatCurrency(p.amount)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateAr(p.date)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {rental.payments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              لم يتم تسجيل أي دفعة
            </p>
          )}

          {/* Inline payment input */}
          {isActive && showPaymentInput && (
            <div className="mt-3 pt-3 border-t border-border space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowPaymentInput(false);
                    setPaymentAmount("");
                    setPaymentError("");
                  }}
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-muted text-muted-foreground flex-shrink-0"
                  aria-label="إلغاء"
                >
                  <X className="w-4 h-4" strokeWidth={2} />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="المبلغ بالدولار"
                  value={paymentAmount}
                  onChange={(e) => {
                    setPaymentAmount(e.target.value);
                    setPaymentError("");
                  }}
                  className="flex-1 bg-muted border-none rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[44px]"
                />
              </div>
              {paymentError && (
                <p className="text-xs text-destructive text-right">{paymentError}</p>
              )}
              <button
                onClick={handleAddPayment}
                className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold active:scale-[0.98] transition-transform"
              >
                تأكيد الدفعة
              </button>
            </div>
          )}
        </div>

        {/* Return confirmation */}
        {isActive && showReturnConfirm && (
          <div className="bg-card rounded-2xl border border-card-border shadow-sm p-4 space-y-3">
            <div className="text-sm font-bold text-foreground text-right">
              تأكيد إعادة السيارة
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-foreground text-right">
                تاريخ الإعادة
              </label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full bg-muted border-none rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[48px]"
              />
            </div>
            {remaining > 0 && (
              <p className="text-xs text-[hsl(var(--status-danger))] text-right font-medium">
                ملاحظة: لا يزال هناك رصيد متبقي {formatCurrency(remaining)}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowReturnConfirm(false)}
                className="flex-1 border border-border text-foreground rounded-xl py-3 text-sm font-semibold active:scale-[0.98] transition-transform"
              >
                إلغاء
              </button>
              <button
                onClick={handleReturn}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold active:scale-[0.98] transition-transform"
              >
                تأكيد الإعادة
              </button>
            </div>
          </div>
        )}

        {/* Action buttons — active rentals only */}
        {isActive && !showReturnConfirm && (
          <div className="space-y-3 pt-1">
            {!showPaymentInput && remaining > 0 && (
              <button
                onClick={() => setShowPaymentInput(true)}
                className="w-full flex items-center justify-center gap-2 border-2 border-primary text-primary rounded-2xl py-4 text-base font-bold active:scale-[0.98] transition-transform"
              >
                <CreditCard className="w-5 h-5" strokeWidth={2} />
                تسجيل دفعة
              </button>
            )}
            <button
              onClick={() => setShowReturnConfirm(true)}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-4 text-base font-bold active:scale-[0.98] transition-transform shadow-sm"
            >
              <RotateCcw className="w-5 h-5" strokeWidth={2} />
              إعادة السيارة
            </button>
          </div>
        )}

        {/* Edit contract — secondary action for all rentals */}
        <button
          onClick={() => {
            setSuccessMsg("سيتم توفير تعديل العقد في إصدار لاحق.");
          }}
          className="w-full flex items-center justify-center gap-2 border border-border text-foreground rounded-2xl py-4 text-base font-bold active:scale-[0.98] transition-transform"
        >
          <FileEdit className="w-5 h-5" strokeWidth={2} />
          تعديل العقد
        </button>
      </div>
    </div>
  );
}
