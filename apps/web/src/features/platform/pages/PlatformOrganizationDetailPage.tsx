import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  getGetPlatformOrganizationQueryKey,
  getListPlatformOrganizationsQueryKey,
  useGetPlatformOrganization,
  useUpdateOrganizationStatus,
  type OrganizationStatus,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  ErrorState,
  InlineError,
  LoadingState,
} from "@/components/ui/FeedbackState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DetailSection } from "@/components/ui/SectionCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate, formatDateTime } from "@/lib/format";

interface Props {
  params: { organizationId: string };
}

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="ui-label mb-1">{label}</p>
      <div className="break-words text-sm font-semibold text-foreground">
        {children}
      </div>
    </div>
  );
}

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

export default function PlatformOrganizationDetailPage({ params }: Props) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] =
    useState<OrganizationStatus | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const organizationQuery = useGetPlatformOrganization(params.organizationId);
  const organization = organizationQuery.data?.data;
  const mutation = useUpdateOrganizationStatus({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: getGetPlatformOrganizationQueryKey(params.organizationId),
        });
        void queryClient.invalidateQueries({
          queryKey: getListPlatformOrganizationsQueryKey(),
        });
        setConfirmOpen(false);
        setSelectedStatus(null);
      },
    },
  });
  const nextStatus = selectedStatus ?? organization?.status;

  function confirmStatusChange() {
    if (!nextStatus) return;
    mutation.mutate({
      organizationId: params.organizationId,
      data: { status: nextStatus },
    });
  }

  if (organizationQuery.isPending) return <LoadingState rows={5} />;
  if (organizationQuery.isError || !organization)
    return (
      <ErrorState
        title="تعذر تحميل المؤسسة"
        description={
          organizationQuery.isError
            ? getApiErrorMessage(organizationQuery.error).title
            : "لم يتم العثور على المؤسسة المطلوبة."
        }
        onRetry={() => void organizationQuery.refetch()}
      />
    );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            className="text-sm font-semibold text-primary"
            onClick={() => setLocation("/platform")}
          >
            العودة إلى المؤسسات
          </button>
          <h1 className="ui-page-title mt-2">{organization.name}</h1>
          <p className="ui-secondary-text mt-1">
            معرّف المؤسسة: <span dir="ltr">{organization.id}</span>
          </p>
        </div>
        <StatusBadge
          status={organization.status}
          label={statusLabels[organization.status]}
        />
      </header>
      <DetailSection title="بيانات المؤسسة">
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <FieldBlock label="الاسم">{organization.name}</FieldBlock>
          <FieldBlock label="الاسم القانوني">
            {organization.legalName ?? "-"}
          </FieldBlock>
          <FieldBlock label="البريد الإلكتروني">
            <span dir="ltr">{organization.email ?? "-"}</span>
          </FieldBlock>
          <FieldBlock label="رقم الهاتف">
            <span dir="ltr">{organization.phone ?? "-"}</span>
          </FieldBlock>
          <FieldBlock label="العنوان">{organization.address ?? "-"}</FieldBlock>
          <FieldBlock label="تاريخ الإنشاء">
            <span dir="ltr">{formatDate(organization.createdAt)}</span>
          </FieldBlock>
          <FieldBlock label="آخر تحديث">
            <span dir="ltr">{formatDateTime(organization.updatedAt)}</span>
          </FieldBlock>
        </div>
      </DetailSection>
      <DetailSection
        title="تغيير حالة المؤسسة"
        description="يؤثر التغيير فوراً على وصول المؤسسة إلى عملياتها."
      >
        <div className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-medium">
            الحالة الجديدة
            <select
              value={nextStatus}
              onChange={(event) =>
                setSelectedStatus(event.target.value as OrganizationStatus)
              }
              className="mt-1 block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {statusLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={nextStatus === organization.status}
          >
            تغيير الحالة
          </Button>
        </div>
        {mutation.isError && (
          <InlineError className="mt-3">
            {getApiErrorMessage(mutation.error).title}
          </InlineError>
        )}
      </DetailSection>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent dir="rtl" className="max-w-md">
          <AlertDialogHeader className="text-start sm:text-start">
            <AlertDialogTitle>تأكيد تغيير الحالة</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم تغيير حالة مؤسسة {organization.name} إلى{" "}
              {nextStatus ? statusLabels[nextStatus] : ""}. قد يتغير وصول
              مستخدميها إلى النظام.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <AlertDialogCancel disabled={mutation.isPending}>
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  confirmStatusChange();
                }}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "جارٍ الحفظ" : "تأكيد التغيير"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
