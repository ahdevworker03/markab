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
import { Button, buttonVariants } from "@/components/ui/button";
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
import { FormField, inputClass } from "@/components/ui/FormField";
import {
  REASON_MAX_LENGTH,
  getNextStatuses,
  isReasonRequired,
  isRestrictiveStatus,
  statusLabels,
} from "../organizationLifecycle";

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

const confirmationCopy: Record<
  OrganizationStatus,
  { title: string; action: string }
> = {
  TRIAL: { title: "تأكيد تغيير الحالة", action: "تأكيد التغيير" },
  ACTIVE: { title: "تأكيد تفعيل المؤسسة", action: "تأكيد التفعيل" },
  SUSPENDED: { title: "تأكيد تعليق المؤسسة", action: "تعليق المؤسسة" },
  CANCELLED: { title: "تأكيد إلغاء المؤسسة", action: "إلغاء المؤسسة" },
};

export default function PlatformOrganizationDetailPage({ params }: Props) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] =
    useState<OrganizationStatus | null>(null);
  const [reason, setReason] = useState("");
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
        setReason("");
      },
    },
  });
  const currentStatus = organization?.status;
  const validNext = currentStatus ? getNextStatuses(currentStatus) : [];
  const nextStatus =
    selectedStatus && validNext.includes(selectedStatus)
      ? selectedStatus
      : currentStatus;
  const changed = !!nextStatus && nextStatus !== currentStatus;
  const reasonRequired =
    changed && !!currentStatus && isReasonRequired(currentStatus, nextStatus);
  const trimmedReason = reason.trim();
  const canSubmit = changed && (!reasonRequired || trimmedReason.length > 0);

  function confirmStatusChange() {
    if (!nextStatus || !canSubmit) return;
    mutation.mutate({
      organizationId: params.organizationId,
      data: {
        status: nextStatus,
        ...(trimmedReason ? { reason: trimmedReason } : {}),
      },
    });
  }

  function changeOpen(open: boolean) {
    if (mutation.isPending) return;
    setConfirmOpen(open);
    if (!open) mutation.reset();
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
        <div className="flex max-w-md flex-col gap-4">
          <label className="text-sm font-medium">
            الحالة الجديدة
            <select
              value={nextStatus}
              onChange={(event) => {
                setSelectedStatus(event.target.value as OrganizationStatus);
                mutation.reset();
              }}
              className="mt-1 block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value={organization.status}>
                {statusLabels[organization.status]} (الحالة الحالية)
              </option>
              {validNext.map((item) => (
                <option key={item} value={item}>
                  {statusLabels[item]}
                </option>
              ))}
            </select>
          </label>
          {reasonRequired && (
            <FormField
              label="سبب التغيير"
              required
              htmlFor="status-change-reason"
              hint="يُسجَّل السبب في سجل التدقيق."
            >
              <textarea
                id="status-change-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={REASON_MAX_LENGTH}
                rows={3}
                className={inputClass}
              />
            </FormField>
          )}
          <Button
            type="button"
            className="self-start"
            onClick={() => setConfirmOpen(true)}
            disabled={!canSubmit}
          >
            تغيير الحالة
          </Button>
        </div>
      </DetailSection>
      <AlertDialog open={confirmOpen} onOpenChange={changeOpen}>
        <AlertDialogContent dir="rtl" className="max-w-md">
          <AlertDialogHeader className="text-start sm:text-start">
            <AlertDialogTitle>
              {nextStatus ? confirmationCopy[nextStatus].title : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              سيتم تغيير حالة مؤسسة {organization.name} من{" "}
              {statusLabels[organization.status]} إلى{" "}
              {nextStatus ? statusLabels[nextStatus] : ""}.{" "}
              {nextStatus && isRestrictiveStatus(nextStatus)
                ? "سيفقد مستخدمو المؤسسة الوصول إلى عملياتها فوراً."
                : "قد يتغير وصول مستخدميها إلى النظام."}
            </AlertDialogDescription>
            {trimmedReason && reasonRequired && (
              <p className="text-sm text-foreground">
                <span className="font-semibold">السبب: </span>
                {trimmedReason}
              </p>
            )}
          </AlertDialogHeader>
          {mutation.isError && (
            <InlineError>{getApiErrorMessage(mutation.error).title}</InlineError>
          )}
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <AlertDialogCancel disabled={mutation.isPending}>
              رجوع
            </AlertDialogCancel>
            <AlertDialogAction
              asChild
              className={
                nextStatus && isRestrictiveStatus(nextStatus)
                  ? buttonVariants({ variant: "destructive" })
                  : undefined
              }
            >
              <Button
                type="button"
                variant={
                  nextStatus && isRestrictiveStatus(nextStatus)
                    ? "destructive"
                    : "default"
                }
                onClick={(event) => {
                  event.preventDefault();
                  confirmStatusChange();
                }}
                disabled={mutation.isPending}
              >
                {mutation.isPending
                  ? "جارٍ الحفظ"
                  : nextStatus
                    ? confirmationCopy[nextStatus].action
                    : "تأكيد"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
