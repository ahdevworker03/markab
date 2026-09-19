import { useState } from "react";
import { Building2, Search } from "lucide-react";
import { useLocation } from "wouter";
import {
  useListPlatformOrganizations,
  type OrganizationStatus,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { DataListShell } from "@/components/ui/DataListShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, LoadingState } from "@/components/ui/FeedbackState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate, formatNumber } from "@/lib/format";

const PAGE_SIZE = 20;
const statuses: readonly OrganizationStatus[] = [
  "TRIAL",
  "ACTIVE",
  "SUSPENDED",
  "CANCELLED",
];

const statusLabels: Record<OrganizationStatus, string> = {
  TRIAL: "تجريبي",
  ACTIVE: "نشط",
  SUSPENDED: "معلّق",
  CANCELLED: "ملغي",
};

export default function PlatformOrganizationsPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrganizationStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const organizationsQuery = useListPlatformOrganizations({
    page,
    pageSize: PAGE_SIZE,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(status === "ALL" ? {} : { status }),
  });
  const organizations = organizationsQuery.data?.data ?? [];
  const pagination = organizationsQuery.data?.pagination;

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function changeStatus(value: OrganizationStatus | "ALL") {
    setStatus(value);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="ui-page-title">المؤسسات</h1>
        <p className="ui-secondary-text mt-1">
          إدارة حالة المؤسسات المشتركة في المنصة.
        </p>
      </header>
      <section
        aria-label="بحث وتصفية المؤسسات"
        className="grid gap-3 rounded-xl border border-card-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_12rem]"
      >
        <label className="relative block">
          <span className="sr-only">البحث في المؤسسات</span>
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(event) => changeSearch(event.target.value)}
            placeholder="ابحث باسم المؤسسة أو البريد الإلكتروني"
            className="h-10 w-full rounded-lg border border-input bg-background pe-3 ps-9 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
        </label>
        <label className="text-sm font-medium text-foreground">
          الحالة
          <select
            value={status}
            onChange={(event) =>
              changeStatus(event.target.value as OrganizationStatus | "ALL")
            }
            className="mt-1 block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="ALL">كل الحالات</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {statusLabels[item]}
              </option>
            ))}
          </select>
        </label>
      </section>
      <DataListShell
        title="قائمة المؤسسات"
        description={
          pagination ? `${formatNumber(pagination.total)} مؤسسة` : undefined
        }
      >
        {organizationsQuery.isPending ? (
          <LoadingState rows={6} />
        ) : organizationsQuery.isError ? (
          <ErrorState
            title="تعذر تحميل المؤسسات"
            description={getApiErrorMessage(organizationsQuery.error).title}
            onRetry={() => void organizationsQuery.refetch()}
          />
        ) : organizations.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={
              debouncedSearch || status !== "ALL"
                ? "لا توجد نتائج مطابقة"
                : "لا توجد مؤسسات"
            }
            description="عدّل البحث أو التصفية وحاول مرة أخرى."
          />
        ) : (
          <table className="w-full min-w-[42rem] text-sm">
            <thead className="border-b border-border bg-muted/40 text-start text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-3">المؤسسة</th>
                <th className="px-4 py-3">البريد الإلكتروني</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">تاريخ الإنشاء</th>
                <th className="px-4 py-3">
                  <span className="sr-only">فتح التفاصيل</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((organization) => (
                <tr
                  key={organization.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {organization.name}
                  </td>
                  <td className="px-4 py-3" dir="ltr">
                    {organization.email ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={organization.status}
                      label={statusLabels[organization.status]}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground" dir="ltr">
                    {formatDate(organization.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setLocation(
                          `/platform/organizations/${organization.id}`,
                        )
                      }
                    >
                      عرض
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DataListShell>
      {pagination && pagination.totalPages > 1 && (
        <nav
          aria-label="صفحات المؤسسات"
          className="flex items-center justify-center gap-3"
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => setPage((current) => current - 1)}
            disabled={page === 1}
          >
            السابق
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحة {formatNumber(page)} من {formatNumber(pagination.totalPages)}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPage((current) => current + 1)}
            disabled={page === pagination.totalPages}
          >
            التالي
          </Button>
        </nav>
      )}
    </div>
  );
}
