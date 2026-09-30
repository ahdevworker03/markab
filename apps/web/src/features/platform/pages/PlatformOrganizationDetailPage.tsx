import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Link } from "wouter";
import {
  getGetPlatformOrganizationQueryKey,
  getListPlatformOrganizationsQueryKey,
  useGetPlatformOrganization,
  useUpdateOrganizationStatus,
  type OrganizationStatus,
  type PlatformOrganizationResponse,
} from "@workspace/api-client-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState, InlineError, LoadingState } from "@/components/ui/FeedbackState";
import { FormField, inputClass } from "@/components/ui/FormField";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { cn } from "@/lib/utils";
import { OrganizationUsersSection } from "../components/OrganizationUsersSection";
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

const confirmationCopy: Record<
  OrganizationStatus,
  { title: string; action: string }
> = {
  TRIAL: { title: "تأكيد تغيير الحالة", action: "تأكيد التغيير" },
  ACTIVE: { title: "تأكيد تفعيل المؤسسة", action: "تأكيد التفعيل" },
  SUSPENDED: { title: "تأكيد تعليق المؤسسة", action: "تعليق المؤسسة" },
  CANCELLED: { title: "تأكيد إلغاء المؤسسة", action: "إلغاء المؤسسة" },
};

const statusEffect: Record<OrganizationStatus, string> = {
  TRIAL: "فترة تجريبية: عمليات المؤسسة متاحة لمستخدميها.",
  ACTIVE: "عمليات المؤسسة متاحة لمستخدميها.",
  SUSPENDED: "عمليات المؤسسة متوقفة، ويرى مستخدموها حالة الحساب فقط.",
  CANCELLED: "عمليات المؤسسة متوقفة، ويرى مستخدموها حالة الحساب فقط.",
};

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children?: ReactNode;
  className?: string;
}) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-foreground">
        {empty ? (
          <span className="font-normal text-muted-foreground/70">غير محدد</span>
        ) : (
          children
        )}
      </dd>
    </div>
  );
}

function OrganizationInfo({
  organization,
  className,
}: {
  organization: PlatformOrganizationResponse;
  className?: string;
}) {
  return (
    <DetailSection title="بيانات المؤسسة" className={className}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:gap-x-8">
        <Field label="الاسم القانوني" className="col-span-2 sm:col-span-1">
          {organization.legalName}
        </Field>
        <Field label="البريد الإلكتروني" className="col-span-2 sm:col-span-1">
          {organization.email && (
            <span className="identifier-ltr break-all">{organization.email}</span>
          )}
        </Field>
        <Field label="رقم الهاتف">
          {organization.phone && (
            <span className="number-ltr">{organization.phone}</span>
          )}
        </Field>
        <Field label="تاريخ الإنشاء">
          <span className="date-token-ltr">{formatDate(organization.createdAt)}</span>
        </Field>
        <Field label="العنوان" className="col-span-2 sm:col-span-1">
          {organization.address}
        </Field>
        <Field label="آخر تحديث" className="col-span-2 sm:col-span-1">
          <span className="date-token-ltr">
            {formatDateTime(organization.updatedAt)}
          </span>
        </Field>
        <Field label="معرّف المؤسسة" className="col-span-2">
          <span className="identifier-ltr break-all text-xs font-normal text-muted-foreground">
            {organization.id}
          </span>
        </Field>
      </dl>
    </DetailSection>
  );
}

export default function PlatformOrganizationDetailPage({ params }: Props) {
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
    selectedStatus && validNext.includes(selectedStatus) ? selectedStatus : null;
  const reasonRequired =
    !!nextStatus && !!currentStatus && isReasonRequired(currentStatus, nextStatus);
  const trimmedReason = reason.trim();
  const canSubmit = !!nextStatus && (!reasonRequired || trimmedReason.length > 0);
  const restrictive = !!nextStatus && isRestrictiveStatus(nextStatus);

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
  if (organizationQuery.isError || !organization) {
    const notFound =
      !organizationQuery.isError ||
      (organizationQuery.error as { status?: number } | null)?.status === 404;
    return (
      <div className="space-y-4">
        <ErrorState
          title={notFound ? "المؤسسة غير موجودة" : "تعذر تحميل المؤسسة"}
          description={
            notFound
              ? "لم يتم العثور على المؤسسة المطلوبة."
              : getApiErrorMessage(organizationQuery.error).title
          }
          onRetry={notFound ? undefined : () => void organizationQuery.refetch()}
        />
        <div className="flex justify-center">
          <Link
            href="/platform"
            className={buttonVariants({ variant: "outline" })}
          >
            العودة إلى المؤسسات
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <Link
          href="/platform"
          className="-ms-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-muted sm:min-h-9"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
          المؤسسات
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="ui-page-title min-w-0 break-words">{organization.name}</h1>
          <StatusBadge
            status={organization.status}
            label={statusLabels[organization.status]}
          />
        </div>
        {organization.email && (
          <p className="ui-secondary-text">
            <span className="identifier-ltr break-all">{organization.email}</span>
          </p>
        )}
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <OrganizationInfo
          organization={organization}
          className="xl:col-start-1 xl:row-start-1"
        />

        <DetailSection
          title="حالة المؤسسة"
          className="xl:sticky xl:top-20 xl:col-start-2 xl:row-span-2 xl:row-start-1"
        >
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="ui-label">الحالة الحالية</span>
                <StatusBadge
                  status={organization.status}
                  label={statusLabels[organization.status]}
                />
              </div>
              <p className="ui-secondary-text mt-1">
                {statusEffect[organization.status]}
              </p>
            </div>

            <div className="min-w-0 space-y-2 border-t border-border pt-4">
              <p id="status-change-label" className="ui-label mb-2">
                تغيير الحالة إلى
              </p>
              <RadioGroup
                dir="rtl"
                aria-labelledby="status-change-label"
                value={nextStatus ?? ""}
                onValueChange={(value) => {
                  setSelectedStatus(value as OrganizationStatus);
                  mutation.reset();
                }}
              >
                {validNext.map((item) => {
                  const danger = isRestrictiveStatus(item);
                  return (
                    <Label
                      key={item}
                      htmlFor={`status-${item}`}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted/50",
                        nextStatus === item &&
                          (danger
                            ? "border-destructive/50 bg-destructive/5"
                            : "border-primary/50 bg-primary/5"),
                        danger && "text-destructive",
                      )}
                    >
                      <RadioGroupItem
                        id={`status-${item}`}
                        value={item}
                        className={danger ? "border-destructive text-destructive" : undefined}
                      />
                      {statusLabels[item]}
                    </Label>
                  );
                })}
              </RadioGroup>
            </div>

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
              variant={restrictive ? "destructive" : "default"}
              className="w-full sm:w-auto xl:w-full"
              onClick={() => setConfirmOpen(true)}
              disabled={!canSubmit}
            >
              تغيير الحالة
            </Button>
          </div>
        </DetailSection>

        <OrganizationUsersSection
          organizationId={params.organizationId}
          organizationStatus={organization.status}
          className="xl:col-start-1 xl:row-start-2"
        />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={changeOpen}>
        <AlertDialogContent dir="rtl" className="max-h-[90dvh] max-w-md overflow-y-auto">
          <AlertDialogHeader className="text-start sm:text-start">
            <AlertDialogTitle>
              {nextStatus ? confirmationCopy[nextStatus].title : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              سيتم تغيير حالة مؤسسة {organization.name} من{" "}
              {statusLabels[organization.status]} إلى{" "}
              {nextStatus ? statusLabels[nextStatus] : ""}.{" "}
              {restrictive
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
            <AlertDialogCancel disabled={mutation.isPending}>رجوع</AlertDialogCancel>
            <AlertDialogAction
              asChild
              className={
                restrictive ? buttonVariants({ variant: "destructive" }) : undefined
              }
            >
              <Button
                type="button"
                variant={restrictive ? "destructive" : "default"}
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
