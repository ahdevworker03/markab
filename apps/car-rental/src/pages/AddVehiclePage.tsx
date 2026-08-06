import { useState } from "react";
import { useLocation } from "wouter";
import { Camera } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { FormField, inputClass } from "@/components/ui/FormField";
import { cn } from "@/lib/utils";
import { VEHICLE_STATUS_LABELS } from "@/lib/labels";

import type { VehicleStatus } from "@/data/types";

interface FormState {
  make: string;
  model: string;
  year: string;
  plate: string;
  dailyPrice: string;
  mileage: string;
  status: VehicleStatus;
  notes: string;
}

const INITIAL: FormState = {
  make: "",
  model: "",
  year: "",
  plate: "",
  dailyPrice: "",
  mileage: "",
  status: "available",
  notes: "",
};

export default function AddVehiclePage() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<FormState> = {};
    if (!form.make.trim()) e.make = "هذا الحقل مطلوب";
    if (!form.model.trim()) e.model = "هذا الحقل مطلوب";
    if (!form.plate.trim()) e.plate = "هذا الحقل مطلوب";
    if (!form.dailyPrice || isNaN(Number(form.dailyPrice)))
      e.dailyPrice = "أدخل رقماً صحيحاً";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    // Prototype: no real persistence — navigate back and show success
    setLocation("/vehicles");
  }

  const isFormFilled =
    form.make.trim().length > 0 &&
    form.model.trim().length > 0 &&
    form.plate.trim().length > 0 &&
    form.dailyPrice.trim().length > 0;

  return (
    <div className="min-h-full pb-8">
      <PageHeader title="إضافة سيارة" showBack />

      <div className="px-4 pt-5 space-y-5">

        {/* ── Photo Placeholder ────────────────────────────────────────── */}
        <div className="w-full aspect-video rounded-2xl border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-3 cursor-pointer active:bg-muted transition-colors">
          <div className="w-14 h-14 rounded-full bg-card flex items-center justify-center shadow-sm">
            <Camera className="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">إضافة صورة</p>
            <p className="text-xs text-muted-foreground mt-0.5">اضغط لاختيار صورة</p>
          </div>
        </div>

        {/* ── Vehicle Info ─────────────────────────────────────────────── */}
        <div className="bg-card rounded-2xl border border-card-border shadow-sm p-4 space-y-4">
          <h3 className="text-sm font-bold text-foreground">معلومات السيارة</h3>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="الماركة" required error={errors.make}>
              <input
                className={errors.make ? `${inputClass} border-destructive focus:ring-destructive/30` : inputClass}
                placeholder="مثال: Toyota"
                value={form.make}
                onChange={(e) => set("make", e.target.value)}
              />
            </FormField>
            <FormField label="الموديل" required error={errors.model}>
              <input
                className={errors.model ? `${inputClass} border-destructive focus:ring-destructive/30` : inputClass}
                placeholder="مثال: Corolla"
                value={form.model}
                onChange={(e) => set("model", e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="السنة">
              <input
                className={inputClass}
                placeholder="مثال: 2022"
                inputMode="numeric"
                value={form.year}
                onChange={(e) => set("year", e.target.value)}
              />
            </FormField>
            <FormField label="رقم اللوحة" required error={errors.plate}>
              <input
                className={errors.plate ? `${inputClass} border-destructive focus:ring-destructive/30` : inputClass}
                placeholder="م أ 12345"
                value={form.plate}
                onChange={(e) => set("plate", e.target.value)}
              />
            </FormField>
          </div>
        </div>

        {/* ── Pricing & Status ─────────────────────────────────────────── */}
        <div className="bg-card rounded-2xl border border-card-border shadow-sm p-4 space-y-4">
          <h3 className="text-sm font-bold text-foreground">السعر والحالة</h3>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="الأجرة اليومية"
              required
              hint="بالدولار"
              error={errors.dailyPrice}
            >
              <input
                className={errors.dailyPrice ? `${inputClass} border-destructive focus:ring-destructive/30` : inputClass}
                placeholder="350,000"
                inputMode="numeric"
                value={form.dailyPrice}
                onChange={(e) => set("dailyPrice", e.target.value)}
              />
            </FormField>
            <FormField label="المسافة المقطوعة" hint="بالكيلومتر">
              <input
                className={inputClass}
                placeholder="50,000"
                inputMode="numeric"
                value={form.mileage}
                onChange={(e) => set("mileage", e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="الحالة">
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => set("status", e.target.value as VehicleStatus)}
            >
              <option value="available">{VEHICLE_STATUS_LABELS.available}</option>
              <option value="rented">{VEHICLE_STATUS_LABELS.rented}</option>
              <option value="maintenance">{VEHICLE_STATUS_LABELS.maintenance}</option>
            </select>
          </FormField>
        </div>

        {/* ── Notes ────────────────────────────────────────────────────── */}
        <FormField label="ملاحظات">
          <textarea
            className={`${inputClass} min-h-[96px] resize-none`}
            placeholder="أي معلومات إضافية عن السيارة..."
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
          />
        </FormField>

        {/* ── Save Button ──────────────────────────────────────────────── */}
        <button
          onClick={handleSave}
          disabled={!isFormFilled}
          className={cn(
            "w-full rounded-2xl py-4 text-base font-bold transition-all shadow-sm",
            isFormFilled
              ? "bg-primary text-primary-foreground active:scale-[0.98]"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          حفظ السيارة
        </button>

      </div>
    </div>
  );
}
