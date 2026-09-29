import { useMemo, useState } from "react";
import { useLocation, useSearchParams } from "wouter";
import { Car, Plus } from "lucide-react";
import type { VehicleResponseStatus } from "@workspace/api-client-react";
import { useVehiclesList } from "@/features/vehicles/api-hooks";
import {
  VehiclesDataList,
  VehiclesDataListSkeleton,
} from "@/features/vehicles/components/VehiclesDataList";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/FeedbackState";
import { FilterChips } from "@/components/ui/FilterChips";
import { SearchBar } from "@/components/ui/SearchBar";
import { SectionCard } from "@/components/ui/SectionCard";
import { VehicleAvailabilitySection } from "@/features/vehicles/components/VehicleAvailabilitySection";
import { SearchCompletionMarker } from "@/components/benchmark/SearchCompletionMarker";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getApiErrorMessage } from "@/lib/api-error";
import { VEHICLE_STATUS_FILTER_OPTIONS } from "@/lib/vehicle-labels";
import { useAuth } from "@/providers/AuthProvider";
import { useOffline } from "@/features/offline/OfflineProvider";

type FilterValue = "all" | VehicleResponseStatus;

export default function VehiclesPage() {
  const [, setLocation] = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const { isOffline } = useOffline();
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const isOwner = user?.role === "OWNER";
  const isBenchmark = import.meta.env.VITE_BENCHMARK === "true";
  const filter = (searchParams.get("filter") as FilterValue) || "all";

  const vehiclesQuery = useVehiclesList(
    debouncedSearch ? { search: debouncedSearch } : undefined,
  );
  const { vehicles } = vehiclesQuery;
  const filteredVehicles = useMemo(
    () =>
      filter === "all"
        ? vehicles
        : vehicles.filter((vehicle) => vehicle.status === filter),
    [filter, vehicles],
  );

  const countLabel = `${filteredVehicles.length} ${filteredVehicles.length === 1 ? "سيارة" : "سيارات"}`;

  return (
    <div className="min-h-full">
      <PageHeader
        title="السيارات"
        action={
          isOwner ? (
            <Button type="button" onClick={() => setLocation("/vehicles/add")}>
              <Plus className="size-4" aria-hidden="true" />
              إضافة سيارة
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-3 px-4 pb-6 pt-4 sm:px-6 lg:space-y-4">
        <SectionCard className="shadow-none">
          <div className="space-y-2.5">
            <SearchBar
              placeholder="ابحث بالاسم أو رقم اللوحة أو سنة الصنع..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
            />
            <FilterChips
              options={VEHICLE_STATUS_FILTER_OPTIONS}
              value={filter}
              onChange={(value) => {
                const nextFilter = value as FilterValue;
                setSearchParams(
                  nextFilter === "all" ? {} : { filter: nextFilter },
                  { replace: true },
                );
              }}
              className="-mb-0.5 flex-wrap gap-1.5 overflow-visible sm:flex-nowrap sm:overflow-x-auto [&_button]:px-2.5 [&_button]:py-1 [&_button]:text-xs"
            />
            {!isOffline && (
              <div className="border-t border-border pt-2.5">
                <VehicleAvailabilitySection compact />
              </div>
            )}
          </div>
        </SectionCard>

        {vehiclesQuery.isLoading ? (
          <SectionCard className="overflow-hidden p-0 shadow-none">
            <VehiclesDataListSkeleton />
          </SectionCard>
        ) : vehiclesQuery.isError ? (
          <SectionCard className="shadow-none">
            <ErrorState
              title="تعذر تحميل السيارات"
              description={getApiErrorMessage(vehiclesQuery.error).title}
              onRetry={() => void vehiclesQuery.refetch()}
            />
          </SectionCard>
        ) : filteredVehicles.length === 0 ? (
          <SectionCard className="shadow-none">
            <EmptyState
              icon={Car}
              title={
                search || filter !== "all"
                  ? "لا توجد نتائج مطابقة"
                  : "لا توجد سيارات بعد"
              }
              description={
                search || filter !== "all"
                  ? "جرّب تغيير كلمة البحث أو إزالة بعض عوامل التصفية."
                  : isOwner
                    ? "أضف أول سيارة لبدء العمل."
                    : "لا توجد سيارات في هذه المنظمة حالياً."
              }
              action={
                isOwner && !search && filter === "all"
                  ? {
                      label: "إضافة سيارة",
                      onClick: () => setLocation("/vehicles/add"),
                    }
                  : undefined
              }
            />
          </SectionCard>
        ) : (
          <SectionCard
            title="السيارات"
            action={
              <span className="text-xs font-medium text-muted-foreground">
                {countLabel}
              </span>
            }
            className="overflow-hidden p-0 shadow-none"
          >
            <VehiclesDataList
              vehicles={filteredVehicles}
              onOpen={(vehicleId) => setLocation(`/vehicles/${vehicleId}`)}
            />
          </SectionCard>
        )}
        {isBenchmark && isOffline ? (
          <SearchCompletionMarker
            result={vehiclesQuery.data}
            ready={!vehiclesQuery.isLoading && !vehiclesQuery.isError}
          />
        ) : null}
      </div>
    </div>
  );
}
