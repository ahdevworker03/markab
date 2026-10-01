import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { FileText, Plus } from "lucide-react";
import {
  useListCustomers,
  useListRentals,
  useListVehicles,
} from "@workspace/api-client-react";
import {
  RentalsDataList,
  RentalsDataListSkeleton,
  type RentalListItem,
} from "@/features/rentals/components/RentalsDataList";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/FeedbackState";
import { FilterChips } from "@/components/ui/FilterChips";
import { SearchBar } from "@/components/ui/SearchBar";
import { SectionCard } from "@/components/ui/SectionCard";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatNumber } from "@/lib/format";
import { RENTAL_STATUS_FILTER_OPTIONS } from "@/lib/rental-labels";
import { useOrgOutstandingBalances } from "@/features/payments/hooks";
import { useAuth } from "@/providers/AuthProvider";

type RentalFilter = "all" | "RESERVED" | "ACTIVE" | "RETURNED" | "CANCELLED";

const PAGE_SIZE = 50;

export default function RentalsPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RentalFilter>("all");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const rentalsQuery = useListRentals(
    debouncedSearch ? { search: debouncedSearch } : undefined,
  );
  const { data: customersData } = useListCustomers();
  const { data: vehiclesData } = useListVehicles();
  const outstandingQuery = useOrgOutstandingBalances();

  const rentals = useMemo(
    () => rentalsQuery.data?.data ?? [],
    [rentalsQuery.data],
  );

  const customerById = useMemo(() => {
    const map = new Map<
      string,
      { firstName: string; lastName: string; phone: string }
    >();
    (customersData?.data ?? []).forEach((customer) =>
      map.set(customer.id, customer),
    );
    return map;
  }, [customersData]);

  const vehicleById = useMemo(() => {
    const map = new Map<
      string,
      { make: string; model: string; plateNumber: string }
    >();
    (vehiclesData?.data ?? []).forEach((vehicle) =>
      map.set(vehicle.id, vehicle),
    );
    return map;
  }, [vehiclesData]);

  const outstandingBalanceByRental = useMemo(() => {
    if (outstandingQuery.isLoading || outstandingQuery.isError) return null;
    return new Map(
      outstandingQuery.balances.map((balance) => [
        balance.rentalId,
        balance.outstandingBalance,
      ]),
    );
  }, [
    outstandingQuery.balances,
    outstandingQuery.isError,
    outstandingQuery.isLoading,
  ]);

  const items = useMemo<RentalListItem[]>(() => {
    return rentals
      .filter(
        (rental) => statusFilter === "all" || rental.status === statusFilter,
      )
      .map((rental) => {
        const customer = customerById.get(rental.customerId);
        const vehicle = vehicleById.get(rental.vehicleId);
        const outstandingBalance = outstandingBalanceByRental?.get(rental.id);

        return {
          rental,
          customerName: customer
            ? `${customer.firstName} ${customer.lastName}`
            : "—",
          customerPhone: customer?.phone,
          vehicleName: vehicle ? `${vehicle.make} ${vehicle.model}` : "—",
          vehiclePlate: vehicle?.plateNumber ?? "—",
          outstandingBalance:
            outstandingBalanceByRental === null
              ? null
              : (outstandingBalance ?? null),
        };
      });
  }, [
    customerById,
    outstandingBalanceByRental,
    rentals,
    statusFilter,
    vehicleById,
  ]);

  const listCount = `${items.length} ${items.length === 1 ? "عقد" : "عقود"}`;
  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const visibleItems = useMemo(
    () => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [items, page],
  );

  return (
    <div className="min-h-full">
      <PageHeader
        title="الإيجارات"
        action={
          isOwner ? (
            <Button type="button" onClick={() => setLocation("/rentals/new")}>
              <Plus className="size-4" aria-hidden="true" />
              إنشاء إيجار
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-4 px-4 pb-6 pt-4 sm:px-6 lg:space-y-5">
        <SectionCard
          className="shadow-none"
          title="قائمة الإيجارات"
          description="تابع العقود الحالية والحجوزات وحالات الإرجاع."
        >
          <div className="space-y-3">
            <SearchBar
              placeholder="ابحث بالعميل أو السيارة..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              onClear={() => {
                setSearch("");
                setPage(1);
              }}
            />
            <FilterChips
              options={RENTAL_STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value as RentalFilter);
                setPage(1);
              }}
              className="-mb-1 flex-wrap overflow-visible sm:flex-nowrap sm:overflow-x-auto [&_button]:px-3 [&_button]:text-xs"
            />
          </div>
        </SectionCard>

        {rentalsQuery.isLoading ? (
          <SectionCard className="overflow-hidden p-0 shadow-none">
            <RentalsDataListSkeleton />
          </SectionCard>
        ) : rentalsQuery.isError ? (
          <SectionCard className="shadow-none">
            <ErrorState
              title="تعذر تحميل الإيجارات"
              description={getApiErrorMessage(rentalsQuery.error).title}
              onRetry={() => void rentalsQuery.refetch()}
            />
          </SectionCard>
        ) : items.length === 0 ? (
          <SectionCard className="shadow-none">
            <EmptyState
              icon={FileText}
              title={
                search || statusFilter !== "all"
                  ? "لا توجد نتائج مطابقة"
                  : "لا توجد إيجارات بعد"
              }
              description={
                search || statusFilter !== "all"
                  ? "جرّب تغيير كلمة البحث أو إزالة بعض عوامل التصفية."
                  : isOwner
                    ? "أنشئ أول عقد إيجار لبدء متابعة عمليات التأجير."
                    : "لا توجد إيجارات في هذه المنظمة حالياً."
              }
              action={
                isOwner && !search && statusFilter === "all"
                  ? {
                      label: "إنشاء إيجار",
                      onClick: () => setLocation("/rentals/new"),
                    }
                  : undefined
              }
            />
          </SectionCard>
        ) : (
          <SectionCard
            className="overflow-hidden p-0 shadow-none"
            title="العقود"
            action={
              <span className="text-xs font-medium text-muted-foreground">
                {listCount}
              </span>
            }
          >
            <RentalsDataList
              items={visibleItems}
              onOpen={(rentalId) => setLocation(`/rentals/${rentalId}`)}
            />
            {totalPages > 1 ? (
              <nav
                aria-label="صفحات الإيجارات"
                className="flex items-center justify-center gap-3 border-t border-border p-3"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => current - 1)}
                  disabled={page === 1}
                >
                  السابق
                </Button>
                <span className="text-sm text-muted-foreground">
                  صفحة {formatNumber(page)} من {formatNumber(totalPages)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={page === totalPages}
                >
                  التالي
                </Button>
              </nav>
            ) : null}
          </SectionCard>
        )}
      </div>
    </div>
  );
}
