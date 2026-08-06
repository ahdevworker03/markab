import { useState } from "react";
import { useLocation } from "wouter";
import { Plus, FileText } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SearchBar } from "@/components/ui/SearchBar";
import { RentalCard } from "@/components/ui/RentalCard";
import { EmptyState } from "@/components/ui/EmptyState";

import { useRentals } from "@/features/rentals/hooks";
import { useCustomer } from "@/features/customers/hooks";
import { useVehicle } from "@/features/vehicles/hooks";

export default function RentalsPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"active" | "ended">("active");
  const [search, setSearch] = useState("");
  const rentals = useRentals();
  const getCustomerById = useCustomer;
  const getVehicleById = useVehicle;

  const filtered = rentals
    .filter((r) => r.status === (tab === "active" ? "active" : "ended"))
    .filter((r) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const customer = getCustomerById(r.customerId);
      const vehicleNames = r.vehicleIds
        .map((vid) => getVehicleById(vid))
        .filter(Boolean)
        .map((v) => `${v!.make} ${v!.model} ${v!.plate}`)
        .join(" ");
      return (
        customer?.name.includes(q) ||
        customer?.phone.includes(q) ||
        vehicleNames.toLowerCase().includes(q)
      );
    });

  return (
    <div className="min-h-full">
      <PageHeader
        title="الإيجارات"
        action={
          <button
            onClick={() => setLocation("/rentals/new")}
            aria-label="إيجار جديد"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5" strokeWidth={2.5} />
          </button>
        }
      />

      <div className="px-4 pt-4 pb-2 space-y-3">
        <SegmentedControl
          options={[
            { label: "نشطة", value: "active" },
            { label: "منتهية", value: "ended" },
          ]}
          value={tab}
          onChange={(v) => setTab(v as "active" | "ended")}
        />
        <SearchBar
          placeholder="ابحث بالعميل أو السيارة..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
        />
        {(search || filtered.length > 0) && (
          <p className="text-xs text-muted-foreground text-right">
            {filtered.length === 0
              ? `لم يتم العثور على نتائج`
              : `عرض ${filtered.length} ${tab === "active" ? "إيجار نشط" : "إيجار منتهي"}`}
          </p>
        )}
      </div>

      <div className="px-4 pb-6 space-y-3">
        {filtered.length === 0 ? (
          search ? (
            <EmptyState
              icon={FileText}
              title="لا توجد نتائج"
              description="جرّب تغيير كلمة البحث"
              className="py-16"
            />
          ) : (
            <EmptyState
              icon={FileText}
              title={
                tab === "active"
                  ? "لا توجد إيجارات نشطة"
                  : "لا توجد إيجارات منتهية"
              }
              description={
                tab === "active" ? "اضغط على + لإنشاء إيجار جديد" : undefined
              }
              action={
                tab === "active"
                  ? {
                      label: "إيجار جديد",
                      onClick: () => setLocation("/rentals/new"),
                    }
                  : undefined
              }
            />
          )
        ) : (
          filtered.map((rental) => {
            const customer = getCustomerById(rental.customerId);
            const vehicle = getVehicleById(rental.vehicleIds[0]);
            return (
              <RentalCard
                key={rental.id}
                rental={rental}
                customerName={customer?.name ?? "—"}
                vehicleName={
                  vehicle ? `${vehicle.make} ${vehicle.model}` : "—"
                }
                vehiclePlate={vehicle?.plate ?? ""}
                onClick={() => setLocation(`/rentals/${rental.id}`)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
