import { useState } from "react";
import { useLocation } from "wouter";

import { PageHeader } from "@/components/layout/PageHeader";
import { FormField, inputClass } from "@/components/ui/FormField";
import { cn } from "@/lib/utils";

interface FormState {
  name: string;
  phone: string;
  location: string;
  notes: string;
}

const INITIAL: FormState = {
  name: "",
  phone: "",
  location: "",
  notes: "",
};

export default function AddCustomerPage() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<FormState> = {};
    if (!form.name.trim()) e.name = "هذا الحقل مطلوب";
    if (!form.phone.trim()) e.phone = "هذا الحقل مطلوب";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    // Prototype: no real persistence — navigate back to customers list
    setLocation("/customers");
  }

  const isFormFilled =
    form.name.trim().length > 0 && form.phone.trim().length > 0;

  return (
    <div className="min-h-full pb-8">
      <PageHeader title="إضافة عميل" showBack />

      <div className="px-4 pt-5 space-y-5">

        {/* ── Customer Info ────────────────────────────────────────────── */}
        <div className="bg-card rounded-2xl border border-card-border shadow-sm p-4 space-y-4">
          <h3 className="text-sm font-bold text-foreground">معلومات العميل</h3>

          <FormField label="الاسم الكامل" required error={errors.name}>
            <input
              className={errors.name ? `${inputClass} border-destructive focus:ring-destructive/30` : inputClass}
              placeholder="مثال: أحمد محمد"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              autoComplete="name"
            />
          </FormField>

          <FormField label="رقم الهاتف" required error={errors.phone}>
            <input
              className={errors.phone ? `${inputClass} border-destructive focus:ring-destructive/30` : inputClass}
              placeholder="مثال: 03-123456"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              autoComplete="tel"
            />
          </FormField>

          <FormField label="الموقع" hint="المنطقة أو المدينة">
            <input
              className={inputClass}
              placeholder="مثال: بيروت"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </FormField>
        </div>

        <FormField label="ملاحظات">
          <textarea
            className={`${inputClass} min-h-[96px] resize-none`}
            placeholder="أي معلومات إضافية..."
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
          />
        </FormField>

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
          حفظ العميل
        </button>

      </div>
    </div>
  );
}
