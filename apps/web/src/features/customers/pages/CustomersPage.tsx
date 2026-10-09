import { useMemo, useState } from "react";
import { useLocation, useSearchParams } from "wouter";
import { Plus, Users } from "lucide-react";
import { useCustomersList } from "@/features/customers/api-hooks";

import {
  CustomersDataList,
  CustomersDataListSkeleton,
} from "@/features/customers/components/CustomersDataList";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/FeedbackState";
import { SearchBar } from "@/components/ui/SearchBar";
import { SectionCard } from "@/components/ui/SectionCard";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatNumber } from "@/lib/format";
import { useAuth } from "@/providers/AuthProvider";
import { useOffline } from "@/features/offline/OfflineProvider";
import { SearchCompletionMarker } from "@/components/benchmark/SearchCompletionMarker";

const PAGE_SIZE = 50;

export default function CustomersPage() {
  const [, setLocation] = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  const { isOffline } = useOffline();
  const isOwner = user?.role === "OWNER";
  const isBenchmark = import.meta.env.VITE_BENCHMARK === "true";
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const customersQuery = useCustomersList(
    debouncedSearch ? { search: debouncedSearch } : undefined,
  );
  const { customers } = customersQuery;
  const totalPages = Math.ceil(customers.length / PAGE_SIZE);
  const visibleCustomers = useMemo(
    () => customers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [customers, page],
  );
  const countLabel = `${customers.length} عميل`;

  return (
    <div className="min-h-full">
      <PageHeader
        title="العملاء"
        action={
          isOwner ? (
            <Button type="button" onClick={() => setLocation("/customers/add")}>
              <Plus className="size-4" aria-hidden="true" />
              إضافة عميل
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-4 px-4 pb-6 pt-4 sm:px-6 lg:space-y-5">
        <SectionCard
          title="قائمة العملاء"
          description="ابحث عن العملاء وراجع بيانات التواصل بسرعة."
          className="shadow-none"
        >
          <SearchBar
            placeholder="ابحث بالاسم أو الهوية أو رقم الرخصة أو الهاتف..."
            value={search}
            onChange={(event) => {
              const value = event.target.value;
              setSearch(value);
              setPage(1);
              setSearchParams(value ? { search: value } : {}, {
                replace: true,
              });
            }}
            onClear={() => {
              setSearch("");
              setPage(1);
              setSearchParams({}, { replace: true });
            }}
          />
        </SectionCard>

        {customersQuery.isLoading ? (
          <SectionCard className="overflow-hidden p-0 shadow-none">
            <CustomersDataListSkeleton />
          </SectionCard>
        ) : customersQuery.isError ? (
          <SectionCard className="shadow-none">
            <ErrorState
              title="تعذر تحميل العملاء"
              description={getApiErrorMessage(customersQuery.error).title}
              onRetry={() => void customersQuery.refetch()}
            />
          </SectionCard>
        ) : customers.length === 0 ? (
          <SectionCard className="shadow-none">
            <EmptyState
              icon={Users}
              title={search ? "لا توجد نتائج مطابقة" : "لا يوجد عملاء بعد"}
              description={
                search
                  ? "جرّب اسماً أو رقماً مختلفاً."
                  : isOwner
                    ? "أضف أول عميل لبدء العمل."
                    : "لا يوجد عملاء في هذه المنظمة حالياً."
              }
              action={
                isOwner && !search
                  ? {
                      label: "إضافة عميل",
                      onClick: () => setLocation("/customers/add"),
                    }
                  : undefined
              }
            />
          </SectionCard>
        ) : (
          <SectionCard
            title="العملاء"
            action={
              <span className="text-xs font-medium text-muted-foreground">
                {countLabel}
              </span>
            }
            className="overflow-hidden p-0 shadow-none"
          >
            <CustomersDataList
              customers={visibleCustomers}
              onOpen={(customerId) => setLocation(`/customers/${customerId}`)}
            />
            {totalPages > 1 ? (
              <nav
                aria-label="صفحات العملاء"
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
        {isBenchmark && isOffline ? (
          <SearchCompletionMarker
            result={customersQuery.data}
            ready={!customersQuery.isLoading && !customersQuery.isError}
          />
        ) : null}
      </div>
    </div>
  );
}
