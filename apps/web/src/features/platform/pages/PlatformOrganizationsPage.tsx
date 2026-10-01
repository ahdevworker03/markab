import { useState } from "react";
import { Building2, ChevronLeft, Plus } from "lucide-react";
import { Link } from "wouter";
import {
  useListPlatformOrganizations,
  type OrganizationStatus,
} from "@workspace/api-client-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, LoadingState } from "@/components/ui/FeedbackState";
import { SearchBar } from "@/components/ui/SearchBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate, formatNumber } from "@/lib/format";
import { statusLabels } from "../organizationLifecycle";

const PAGE_SIZE = 20;
const statuses: readonly OrganizationStatus[] = [
  "TRIAL",
  "ACTIVE",
  "SUSPENDED",
  "CANCELLED",
];

const rowGrid =
  "md:grid md:grid-cols-[minmax(0,1fr)_7rem_7.5rem_1.5rem] md:items-center md:gap-4";

/** Short, stable form of a UUID for telling same-named organizations apart; the full id is in the title. */
function shortId(id: string): string {
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export default function PlatformOrganizationsPage() {
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
  const filtered = !!debouncedSearch || status !== "ALL";

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function changeStatus(value: OrganizationStatus | "ALL") {
    setStatus(value);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="ui-page-title">المؤسسات</h1>
          <p className="ui-secondary-text mt-1">
            المؤسسات العميلة المشتركة في مَركب وحالة كل منها.
          </p>
        </div>
        <Link
          href="/platform/organizations/new"
          className={`${buttonVariants()} w-full shrink-0 gap-2 sm:w-auto`}
        >
          <Plus className="size-4" aria-hidden="true" />
          إضافة مؤسسة
        </Link>
      </header>

      <section
        aria-labelledby="organizations-list-heading"
        className="overflow-hidden rounded-xl border border-card-border bg-card shadow-sm"
      >
        <div className="grid gap-3 border-b border-border p-3 sm:p-4 md:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] md:items-center">
          <SearchBar
            aria-label="البحث في المؤسسات"
            placeholder="ابحث باسم المؤسسة أو بريدها الإلكتروني"
            value={search}
            onChange={(event) => changeSearch(event.target.value)}
            onClear={() => changeSearch("")}
            className="min-w-0 [&_input]:min-h-11 md:[&_input]:min-h-10"
          />
          <Select
            dir="rtl"
            value={status}
            onValueChange={(value) =>
              changeStatus(value as OrganizationStatus | "ALL")
            }
          >
            <SelectTrigger
              aria-label="تصفية حسب الحالة"
              className="h-11 w-full gap-2 rounded-xl border-transparent bg-muted px-3 text-sm md:h-10"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="ALL">كل الحالات</SelectItem>
              {statuses.map((item) => (
                <SelectItem key={item} value={item}>
                  {statusLabels[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-baseline justify-between gap-3 px-4 pb-1 pt-3 sm:px-5">
          <h2 id="organizations-list-heading" className="ui-section-title">
            قائمة المؤسسات
          </h2>
          {pagination && (
            <p
              className="text-xs tabular-nums text-muted-foreground"
              aria-live="polite"
            >
              {formatNumber(pagination.total)} مؤسسة
            </p>
          )}
        </div>

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
            title={filtered ? "لا توجد نتائج مطابقة" : "لا توجد مؤسسات"}
            description={
              filtered
                ? "عدّل البحث أو التصفية وحاول مرة أخرى."
                : "ستظهر هنا المؤسسات العميلة عند تسجيلها."
            }
          />
        ) : (
          <>
            <div
              aria-hidden="true"
              className={`hidden border-b border-border bg-muted/40 px-5 py-2 text-xs font-semibold text-muted-foreground ${rowGrid} md:grid`}
            >
              <span>المؤسسة</span>
              <span>الحالة</span>
              <span>تاريخ الإنشاء</span>
              <span />
            </div>
            <ul>
              {organizations.map((organization) => (
                <li
                  key={organization.id}
                  className="border-b border-border last:border-0"
                >
                  <Link
                    href={`/platform/organizations/${organization.id}`}
                    className={`group flex min-h-16 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5 ${rowGrid}`}
                  >
                    <span className="min-w-0 basis-[calc(100%-2rem)] md:basis-auto">
                      <span className="line-clamp-2 break-words text-sm font-semibold leading-snug text-foreground md:text-base">
                        {organization.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        <span
                          className="identifier-ltr tabular-nums"
                          title={organization.id}
                        >
                          {shortId(organization.id)}
                        </span>
                      </span>
                    </span>
                    <ChevronLeft
                      className="size-5 shrink-0 text-muted-foreground transition group-hover:-translate-x-0.5 group-hover:text-foreground group-focus-visible:-translate-x-0.5 group-focus-visible:text-foreground md:order-last"
                      aria-hidden="true"
                    />
                    <span className="flex items-center gap-3 md:contents">
                      <StatusBadge
                        status={organization.status}
                        label={statusLabels[organization.status]}
                        className="md:justify-self-start"
                      />
                      <span className="text-xs text-muted-foreground md:text-sm">
                        <span className="sr-only">تاريخ الإنشاء: </span>
                        <span className="date-token-ltr">
                          {formatDate(organization.createdAt)}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {pagination && pagination.totalPages > 1 && (
          <nav
            aria-label="صفحات المؤسسات"
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
              صفحة {formatNumber(page)} من {formatNumber(pagination.totalPages)}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => current + 1)}
              disabled={page === pagination.totalPages}
            >
              التالي
            </Button>
          </nav>
        )}
      </section>
    </div>
  );
}
