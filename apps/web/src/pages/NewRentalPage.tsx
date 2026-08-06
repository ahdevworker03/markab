import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Car, User, ChevronRight, Check, Search, X } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { FormField, inputClass } from "@/components/ui/FormField";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MOCK_TODAY_STR, toISO } from "@/lib/mock-date";
import { useTimeout } from "@/hooks/useTimeout";
import { useRentals } from "@/features/rentals/hooks";
import { useVehicles } from "@/features/vehicles/hooks";
import { useCustomers } from "@/features/customers/hooks";
import type { Rental } from "@/data/types";

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function NewRentalPage() {
  const [, setLocation] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const preVehicle = params.get("vehicle") ?? "";
  const preCustomer = params.get("customer") ?? "";

  // ── Form state ────────────────────────────────────────────────────────────
  const [selectedVehicleId, setSelectedVehicleId] = useState(preVehicle);
  const [selectedCustomerId, setSelectedCustomerId] = useState(preCustomer);

  const [vehicleSearch, setVehicleSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");

  const [showVehiclePicker, setShowVehiclePicker] = useState(!preVehicle);
  const [showCustomerPicker, setShowCustomerPicker] = useState(!!preVehicle && !preCustomer);

  const [startDate, setStartDate] = useState(MOCK_TODAY_STR);
  const [endDate, setEndDate] = useState("");
  const [dailyPrice, setDailyPrice] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  // Redirect after save, cleaned up if the user navigates away first
  useTimeout(() => setLocation("/rentals"), saved ? 1200 : null);

  const rentals = useRentals();
  const vehicles = useVehicles();
  const customers = useCustomers();

  // ── Derived ───────────────────────────────────────────────────────────────
  const availableVehicles = useMemo(
    () => vehicles.filter((v) => v.status === "available"),
    []
  );

  const filteredVehicles = useMemo(() => {
    const q = vehicleSearch.trim().toLowerCase();
    if (!q) return availableVehicles;
    return availableVehicles.filter(
      (v) =>
        `${v.make} ${v.model}`.toLowerCase().includes(q) ||
        v.plate.toLowerCase().includes(q)
    );
  }, [availableVehicles, vehicleSearch]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.includes(q) ||
        c.phone.includes(q) ||
        c.location.toLowerCase().includes(q)
    );
  }, [customerSearch]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const days = calcDays(startDate, endDate);
  const price = parseInt(dailyPrice.replace(/,/g, ""), 10) || 0;
  const total = days * price;
  const paid = parseInt(paidAmount.replace(/,/g, ""), 10) || 0;
  const remaining = Math.max(0, total - paid);

  const canSave = !!selectedVehicleId && !!selectedCustomerId && !!startDate && !!endDate && !!dailyPrice && price > 0;

  const stepVehicleDone = !!selectedVehicleId;
  const stepCustomerDone = !!selectedCustomerId;
  const currentStepIdx = !stepVehicleDone ? 0 : !stepCustomerDone ? 1 : 2;

  function clearError(key: string) {
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  const STEPS = [
    { key: "vehicle", label: "السيارة" },
    { key: "customer", label: "العميل" },
    { key: "details", label: "التفاصيل" },
  ];

  function stepState(idx: number): "done" | "current" | "future" {
    if (idx < currentStepIdx) return "done";
    if (idx === currentStepIdx) return "current";
    return "future";
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  function selectVehicle(id: string) {
    const v = vehicles.find((v) => v.id === id);
    setSelectedVehicleId(id);
    setShowVehiclePicker(false);
    if (v && !dailyPrice) {
      setDailyPrice(String(v.dailyPrice));
    }
    if (!selectedCustomerId) setShowCustomerPicker(true);
  }

  function selectCustomer(id: string) {
    setSelectedCustomerId(id);
    setShowCustomerPicker(false);
  }

  function removeVehicle() {
    setSelectedVehicleId("");
    setShowVehiclePicker(true);
    setDailyPrice("");
    setVehicleSearch("");
  }

  function removeCustomer() {
    setSelectedCustomerId("");
    setShowCustomerPicker(true);
    setCustomerSearch("");
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!selectedVehicleId) errs.vehicle = "اختر سيارة";
    if (!selectedCustomerId) errs.customer = "اختر عميلاً";
    if (!startDate) errs.startDate = "أدخل تاريخ البداية";
    if (!endDate) errs.endDate = "أدخل تاريخ الانتهاء";
    if (endDate && startDate && endDate <= startDate)
      errs.endDate = "تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية";
    if (!dailyPrice || price <= 0) errs.dailyPrice = "أدخل الأجرة اليومية";
    if (paid > total && total > 0) errs.paidAmount = "المبلغ المدفوع أكبر من الإجمالي";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!validate()) return;

    const newRental: Rental = {
      id: `r-${Date.now()}`,
      vehicleIds: [selectedVehicleId],
      customerId: selectedCustomerId,
      startDate: toISO(startDate),
      endDate: toISO(endDate),
      dailyPrices: { [selectedVehicleId]: price },
      payments: paid > 0
        ? [{ id: `pay-${Date.now()}`, amount: paid, date: toISO(startDate) }]
        : [],
      totalAmount: total,
      notes: notes.trim() || undefined,
      status: "active",
    };

    rentals.push(newRental);
    const vIdx = vehicles.findIndex((v) => v.id === selectedVehicleId);
    if (vIdx !== -1) {
      vehicles[vIdx] = { ...vehicles[vIdx], status: "rented" };
    }

    setSaved(true);
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (saved) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background px-6 gap-3">
        <div className="w-20 h-20 rounded-full bg-[hsl(var(--status-available-bg))] flex items-center justify-center">
          <Check className="w-10 h-10 text-[hsl(var(--status-available))]" strokeWidth={2.5} />
        </div>
        <h2 className="text-xl font-bold text-foreground">تم إنشاء عقد الإيجار</h2>
        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p>{selectedVehicle?.make} {selectedVehicle?.model}</p>
          <p>العميل: {selectedCustomer?.name}</p>
        </div>
        <p className="text-xs text-muted-foreground pt-2">
          جاري العودة إلى قائمة الإيجارات...
        </p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="تأجير جديد"
        showBack
        onBack={() => setLocation("/rentals")}
      />

      {/* ── Step Progress ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-center gap-0 px-6 pt-3 pb-1">
        {STEPS.map((step, idx) => {
          const state = stepState(idx);
          const isLast = idx === STEPS.length - 1;
          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                    state === "done" && "bg-[hsl(var(--status-available))] text-white",
                    state === "current" && "bg-primary text-primary-foreground ring-2 ring-primary/20",
                    state === "future" && "bg-muted text-muted-foreground"
                  )}
                >
                  {state === "done" ? (
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    state === "future" ? "text-muted-foreground" : "text-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "flex-1 h-[2px] mx-2 mb-5 rounded-full",
                    state === "done" ? "bg-[hsl(var(--status-available))]" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-8 space-y-4">

        {/* ── 1. Vehicle picker ─────────────────────────────────────────── */}
        <div className="bg-card rounded-2xl border border-card-border shadow-sm overflow-hidden">
          {/* Overlay toggle keeps the clear-selection button from nesting inside another button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowVehiclePicker((v) => !v)}
              aria-expanded={showVehiclePicker}
              aria-label="اختيار السيارة"
              className="absolute inset-0 w-full rounded-2xl"
            />
            <div className="w-full flex items-center justify-between p-4 pointer-events-none">
            <ChevronRight
              className={`w-4 h-4 text-muted-foreground transition-transform ${
                showVehiclePicker ? "-rotate-90" : ""
              }`}
              strokeWidth={2}
            />
            <div className="flex items-center gap-3 flex-1 justify-end">
              {selectedVehicle ? (
                <>
                  <button
                    type="button"
                    onClick={removeVehicle}
                    className="pointer-events-auto relative w-8 h-8 rounded-full flex items-center justify-center bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:scale-90 transition-all flex-shrink-0"
                    aria-label="إلغاء اختيار السيارة"
                  >
                    <X className="w-4 h-4" strokeWidth={2} />
                  </button>
                  <div className="text-right">
                    <div className="text-sm font-bold text-foreground">
                      {selectedVehicle.make} {selectedVehicle.model}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {selectedVehicle.plate}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-semibold text-foreground">
                        {formatCurrency(selectedVehicle.dailyPrice)}/يوم
                      </span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[hsl(var(--status-available-bg))] text-[hsl(var(--status-available))]">
                        متاحة
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <span className="text-sm font-semibold text-muted-foreground">
                  اختر السيارة
                  <span className="text-destructive mr-1">*</span>
                </span>
              )}
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Car className="w-5 h-5 text-primary" strokeWidth={1.5} />
              </div>
            </div>
            </div>
          </div>

          {errors.vehicle && (
            <p className="text-xs text-destructive px-4 pb-2 text-right">
              {errors.vehicle}
            </p>
          )}

          {showVehiclePicker && (
            <div className="border-t border-border px-4 pt-3 pb-4 space-y-2">
              <div className="relative">
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <Search className="w-4 h-4 text-muted-foreground" />
                </div>
                <input
                  type="search"
                  placeholder="ابحث..."
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  className="w-full bg-muted rounded-xl pr-9 pl-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 border-none"
                />
              </div>

              {availableVehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  جميع السيارات مؤجرة حالياً
                </p>
              ) : filteredVehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">
                  لا توجد نتائج
                </p>
              ) : (
                filteredVehicles.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => selectVehicle(v.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      selectedVehicleId === v.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background"
                    }`}
                  >
                    <div className="text-right flex-1">
                      <div className="text-sm font-bold text-foreground">
                        {v.make} {v.model}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {v.plate} · {formatCurrency(v.dailyPrice)}/يوم
                      </div>
                    </div>
                    <div className="w-12 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {v.photos.length > 0 ? (
                        <img
                          src={v.photos[0]}
                          alt={`${v.make} ${v.model}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Car
                            className="w-5 h-5 text-muted-foreground"
                            strokeWidth={1.5}
                          />
                        </div>
                      )}
                    </div>
                    {selectedVehicleId === v.id && (
                      <Check
                        className="w-4 h-4 text-primary flex-shrink-0"
                        strokeWidth={2.5}
                      />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── 2. Customer picker ────────────────────────────────────────── */}
        <div className="bg-card rounded-2xl border border-card-border shadow-sm overflow-hidden">
          {/* Overlay toggle keeps the clear-selection button from nesting inside another button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCustomerPicker((v) => !v)}
              aria-expanded={showCustomerPicker}
              aria-label="اختيار العميل"
              className="absolute inset-0 w-full rounded-2xl"
            />
            <div className="w-full flex items-center justify-between p-4 pointer-events-none">
            <ChevronRight
              className={`w-4 h-4 text-muted-foreground transition-transform ${
                showCustomerPicker ? "-rotate-90" : ""
              }`}
              strokeWidth={2}
            />
            <div className="flex items-center gap-3 flex-1 justify-end">
              {selectedCustomer ? (
                <>
                  <button
                    type="button"
                    onClick={removeCustomer}
                    className="pointer-events-auto relative w-8 h-8 rounded-full flex items-center justify-center bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:scale-90 transition-all flex-shrink-0"
                    aria-label="إلغاء اختيار العميل"
                  >
                    <X className="w-4 h-4" strokeWidth={2} />
                  </button>
                  <div className="text-right">
                    <div className="text-sm font-bold text-foreground">
                      {selectedCustomer.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {selectedCustomer.phone}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {selectedCustomer.location}
                    </div>
                  </div>
                </>
              ) : (
                <span className="text-sm font-semibold text-muted-foreground">
                  اختر العميل
                  <span className="text-destructive mr-1">*</span>
                </span>
              )}
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-primary" strokeWidth={1.5} />
              </div>
            </div>
            </div>
          </div>

          {errors.customer && (
            <p className="text-xs text-destructive px-4 pb-2 text-right">
              {errors.customer}
            </p>
          )}

          {showCustomerPicker && (
            <div className="border-t border-border px-4 pt-3 pb-4 space-y-2">
              <div className="relative">
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <Search className="w-4 h-4 text-muted-foreground" />
                </div>
                <input
                  type="search"
                  placeholder="ابحث بالاسم أو الهاتف..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full bg-muted rounded-xl pr-9 pl-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 border-none"
                />
              </div>

              {filteredCustomers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">
                  لا توجد نتائج
                </p>
              ) : (
                filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectCustomer(c.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      selectedCustomerId === c.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background"
                    }`}
                  >
                    <div className="text-right flex-1">
                      <div className="text-sm font-bold text-foreground">
                        {c.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.phone} · {c.location}
                      </div>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold text-xs">
                      {c.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}
                    </div>
                    {selectedCustomerId === c.id && (
                      <Check
                        className="w-4 h-4 text-primary flex-shrink-0"
                        strokeWidth={2.5}
                      />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── 3. Rental details ─────────────────────────────────────────── */}
        <div className="bg-card rounded-2xl border border-card-border shadow-sm p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="تاريخ البداية" required error={errors.startDate}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); clearError("startDate"); }}
                className={errors.startDate ? `${inputClass} border-destructive focus:ring-destructive/30` : inputClass}
              />
            </FormField>

            <FormField label="تاريخ الانتهاء" required error={errors.endDate}>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => { setEndDate(e.target.value); clearError("endDate"); }}
                className={errors.endDate ? `${inputClass} border-destructive focus:ring-destructive/30` : inputClass}
              />
            </FormField>
          </div>

          <FormField
            label="الأجرة اليومية"
            required
            hint="بالدولار"
            error={errors.dailyPrice}
          >
            <input
              type="number"
              inputMode="numeric"
              placeholder="مثال: 300000"
              value={dailyPrice}
              onChange={(e) => { setDailyPrice(e.target.value); clearError("dailyPrice"); }}
              className={errors.dailyPrice ? `${inputClass} border-destructive focus:ring-destructive/30` : inputClass}
            />
          </FormField>

          <FormField label="الدفعة الأولى" hint="اختياري" error={errors.paidAmount}>
            <input
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={paidAmount}
              onChange={(e) => { setPaidAmount(e.target.value); clearError("paidAmount"); }}
              className={errors.paidAmount ? `${inputClass} border-destructive focus:ring-destructive/30` : inputClass}
            />
          </FormField>

          {/* ── Rental Summary ──────────────────────────────────────────── */}
          {days > 0 && price > 0 && selectedVehicle && selectedCustomer && (
            <div className="border-t border-border pt-4 mt-2 space-y-3">
              <h3 className="text-sm font-bold text-foreground">ملخص الإيجار</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">السيارة</span>
                  <span className="font-semibold text-foreground">{selectedVehicle.make} {selectedVehicle.model}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">العميل</span>
                  <span className="font-semibold text-foreground">{selectedCustomer.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">المدة</span>
                  <span className="font-semibold text-foreground">{startDate} → {endDate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">الأجرة اليومية</span>
                  <span className="font-semibold text-foreground">{formatCurrency(price)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">عدد الأيام</span>
                  <span className="font-semibold text-foreground">{days}</span>
                </div>
                <div className="border-t border-border pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">الإجمالي</span>
                    <span className="text-lg font-bold text-foreground">{formatCurrency(total)}</span>
                  </div>
                </div>
                {paid > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">المدفوع</span>
                    <span className="font-semibold text-foreground">{formatCurrency(paid)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">الرصيد المتبقي</span>
                  <span
                    className={`font-bold ${
                      remaining > 0
                        ? "text-[hsl(var(--status-danger))]"
                        : "text-[hsl(var(--status-available))]"
                    }`}
                  >
                    {remaining > 0 ? formatCurrency(remaining) : "مدفوع بالكامل"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── 4. Notes ──────────────────────────────────────────────────── */}
        <FormField label="ملاحظات" hint="اختياري">
          <textarea
            placeholder="أي ملاحظات إضافية..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </FormField>

        {/* ── Save button ───────────────────────────────────────────────── */}
        <button
          onClick={handleSave}
          disabled={!canSave}
          className={cn(
            "w-full rounded-2xl py-4 text-base font-bold transition-all shadow-sm",
            canSave
              ? "bg-primary text-primary-foreground active:scale-[0.98]"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          حفظ الإيجار
        </button>
      </div>
    </>
  );
}
