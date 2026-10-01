import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListPlatformOrganizationUsersQueryKey,
  useDeactivatePlatformEmployee,
  useListPlatformOrganizationUsers,
  useRequestPlatformOwnerPasswordReset,
  useResendPlatformEmployeeInvitation,
  type OrganizationStatus,
  type PlatformOrganizationInvitation,
  type PlatformOrganizationInvitationStatus,
  type PlatformOrganizationUser,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  ErrorState,
  InlineFeedback,
  LoadingState,
} from "@/components/ui/FeedbackState";
import { FormField, inputClass } from "@/components/ui/FormField";
import { DetailSection } from "@/components/ui/SectionCard";
import { StatusBadge, type StatusType } from "@/components/ui/StatusBadge";
import {
  InvitationLinkNotice,
  type IssuedInvitation,
} from "@/components/invitations/InvitationLinkNotice";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { REASON_MAX_LENGTH } from "../organizationLifecycle";
import { SupportActionDialog } from "./SupportActionDialog";

const invitationBadge: Record<
  PlatformOrganizationInvitationStatus,
  { status: StatusType; label: string }
> = {
  PENDING: { status: "PENDING", label: "قيد الانتظار" },
  EXPIRED: { status: "ARCHIVED", label: "منتهية" },
  ACCEPTED: { status: "COMPLETED", label: "مقبولة" },
};

function Email({ value }: { value: string }) {
  return (
    <span className="block text-start text-sm font-semibold text-foreground">
      <span className="identifier-ltr break-all">{value}</span>
    </span>
  );
}

function Meta({ label, date }: { label: string; date: string }) {
  return (
    <span className="text-xs text-muted-foreground">
      {label} <span className="date-token-ltr">{formatDate(date)}</span>
    </span>
  );
}

function Row({
  children,
  emphasized = false,
}: {
  children: ReactNode;
  emphasized?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex flex-col gap-2 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        emphasized && "-mx-3 rounded-lg border-transparent bg-primary/5 px-3",
      )}
    >
      {children}
    </li>
  );
}

function RoleMarker({ role }: { role: PlatformOrganizationUser["role"] }) {
  if (role === "OWNER") {
    return (
      <span className="ui-badge-text inline-flex min-h-6 items-center rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 whitespace-nowrap text-primary">
        مالك المؤسسة
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-muted-foreground">موظف</span>
  );
}

type PendingDialog =
  | { kind: "recover"; user: PlatformOrganizationUser }
  | { kind: "deactivate"; user: PlatformOrganizationUser }
  | null;

/** Read-only access overview plus three narrow support actions; failures stay local to this section. */
export function OrganizationUsersSection({
  organizationId,
  organizationStatus,
  className,
}: {
  organizationId: string;
  organizationStatus?: OrganizationStatus;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const query = useListPlatformOrganizationUsers(organizationId);
  const users = query.data?.data.users ?? [];
  const invitations = query.data?.data.invitations ?? [];
  const hasEmployees = users.some((user) => user.role === "EMPLOYEE");
  const invitationsBlocked =
    organizationStatus === "SUSPENDED" || organizationStatus === "CANCELLED";

  const [dialog, setDialog] = useState<PendingDialog>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedInvitation | null>(null);

  const resend = useResendPlatformEmployeeInvitation();
  const recover = useRequestPlatformOwnerPasswordReset();
  const deactivate = useDeactivatePlatformEmployee();

  function closeDialog() {
    setDialog(null);
    setReason("");
    recover.reset();
    deactivate.reset();
  }

  function dismissInvitation() {
    setIssued(null);
    resend.reset();
  }

  function resendInvitation(invitation: PlatformOrganizationInvitation) {
    setNotice(null);
    setIssued(null);
    resend.mutate(
      { organizationId, invitationId: invitation.id },
      {
        onSuccess: (response) => {
          setIssued({
            email: response.data.email,
            expiresAt: response.data.expiresAt,
            acceptanceToken: response.data.acceptanceToken,
          });
          resend.reset();
          void queryClient.invalidateQueries({
            queryKey: getListPlatformOrganizationUsersQueryKey(organizationId),
          });
        },
      },
    );
  }

  function confirmRecovery() {
    recover.mutate(
      { organizationId },
      {
        onSuccess: () => {
          closeDialog();
          setNotice("تم طلب إرسال رابط استعادة كلمة المرور.");
        },
      },
    );
  }

  function confirmDeactivation() {
    if (dialog?.kind !== "deactivate" || !reason.trim()) return;
    deactivate.mutate(
      {
        organizationId,
        userId: dialog.user.id,
        data: { reason: reason.trim() },
      },
      {
        onSuccess: () => {
          closeDialog();
          setNotice("تم تعطيل حساب الموظف.");
          void queryClient.invalidateQueries({
            queryKey: getListPlatformOrganizationUsersQueryKey(organizationId),
          });
        },
      },
    );
  }

  function renderUser(user: PlatformOrganizationUser) {
    return (
      <Row key={user.id} emphasized={user.role === "OWNER"}>
        <div className="min-w-0 space-y-1.5 sm:flex-1">
          <Email value={user.email} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <RoleMarker role={user.role} />
            {user.status === "ACTIVE" ? (
              <StatusBadge status="ACTIVE" label="نشط" />
            ) : (
              <StatusBadge status="ARCHIVED" label="غير نشط" />
            )}
            <Meta label="أُنشئ في" date={user.createdAt} />
            {user.deactivatedAt && (
              <Meta label="عُطّل في" date={user.deactivatedAt} />
            )}
          </div>
        </div>
        {user.role === "OWNER" && user.status === "ACTIVE" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto sm:shrink-0"
            onClick={() => setDialog({ kind: "recover", user })}
          >
            إرسال رابط استعادة كلمة المرور
          </Button>
        )}
        {user.role === "EMPLOYEE" && user.status === "ACTIVE" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full border-transparent bg-destructive/5 text-destructive hover:bg-destructive/10 sm:w-auto sm:shrink-0 sm:bg-transparent sm:hover:bg-destructive/5"
            onClick={() => setDialog({ kind: "deactivate", user })}
          >
            تعطيل الموظف
          </Button>
        )}
      </Row>
    );
  }

  function renderInvitation(invitation: PlatformOrganizationInvitation) {
    const badge = invitationBadge[invitation.status];
    const resendable = invitation.status !== "ACCEPTED";
    return (
      <Row key={invitation.id}>
        <div className="min-w-0 space-y-1.5 sm:flex-1">
          <Email value={invitation.email} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <StatusBadge status={badge.status} label={badge.label} />
            <Meta label="أُنشئت في" date={invitation.createdAt} />
            {invitation.status === "ACCEPTED" && invitation.acceptedAt ? (
              <Meta label="قُبلت في" date={invitation.acceptedAt} />
            ) : (
              <Meta
                label={
                  invitation.status === "EXPIRED" ? "انتهت في" : "تنتهي في"
                }
                date={invitation.expiresAt}
              />
            )}
          </div>
        </div>
        {resendable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto sm:shrink-0"
            disabled={invitationsBlocked || resend.isPending}
            onClick={() => resendInvitation(invitation)}
          >
            {resend.isPending ? "جارٍ الإرسال" : "إعادة إرسال الدعوة"}
          </Button>
        )}
      </Row>
    );
  }

  return (
    <DetailSection
      title="مستخدمو المؤسسة"
      description="حسابات المؤسسة ودعواتها، مع إجراءات دعم محدودة."
      className={className}
    >
      {query.isPending ? (
        <LoadingState rows={3} className="p-0" />
      ) : query.isError ? (
        <ErrorState
          className="py-8"
          title="تعذر تحميل مستخدمي المؤسسة"
          description={getApiErrorMessage(query.error).title}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <div className="space-y-6">
          {notice && (
            <InlineFeedback variant="success" onDismiss={() => setNotice(null)}>
              {notice}
            </InlineFeedback>
          )}
          <section aria-labelledby="org-users-heading">
            <h3 id="org-users-heading" className="ui-label mb-1">
              الحسابات{" "}
              <span className="font-normal text-muted-foreground">
                ({formatNumber(users.length)})
              </span>
            </h3>
            <ul>{users.map(renderUser)}</ul>
            {!hasEmployees && (
              <p className="ui-secondary-text pt-2">
                لا يوجد موظفون في هذه المؤسسة.
              </p>
            )}
          </section>
          <section aria-labelledby="org-invitations-heading">
            <h3 id="org-invitations-heading" className="ui-label mb-1">
              الدعوات{" "}
              <span className="font-normal text-muted-foreground">
                ({formatNumber(invitations.length)})
              </span>
            </h3>
            {issued && (
              <InvitationLinkNotice
                variant="resent"
                invitation={issued}
                onDismiss={dismissInvitation}
              />
            )}
            {resend.isError && (
              <InlineFeedback variant="error" className="my-2">
                {getApiErrorMessage(resend.error).title}
              </InlineFeedback>
            )}
            {invitationsBlocked &&
              invitations.some((i) => i.status !== "ACCEPTED") && (
                <p className="ui-secondary-text py-1">
                  لا يمكن إعادة إرسال الدعوات لمؤسسة معلّقة أو ملغاة.
                </p>
              )}
            {invitations.length === 0 ? (
              <p className="ui-secondary-text pt-1">لا توجد دعوات حالية.</p>
            ) : (
              <ul>{invitations.map(renderInvitation)}</ul>
            )}
          </section>
        </div>
      )}
      <SupportActionDialog
        open={dialog?.kind === "recover"}
        onClose={closeDialog}
        title="استعادة كلمة مرور المالك"
        confirmLabel="طلب إرسال الرابط"
        pending={recover.isPending}
        error={recover.isError ? getApiErrorMessage(recover.error).title : null}
        onConfirm={confirmRecovery}
      >
        <p>
          سيبدأ هذا الإجراء استعادة كلمة المرور لمالك المؤسسة{" "}
          <span className="identifier-ltr break-all font-semibold">
            {dialog?.user.email}
          </span>{" "}
          عبر قناة الاستعادة المهيأة. لا يرى مشرف المنصة كلمة المرور ولا
          يعيّنها. عند إكمال الاستعادة تنتهي جلسات المالك الحالية.
        </p>
      </SupportActionDialog>
      <SupportActionDialog
        open={dialog?.kind === "deactivate"}
        onClose={closeDialog}
        title="تعطيل الموظف"
        confirmLabel="تعطيل الموظف"
        destructive
        confirmDisabled={!reason.trim()}
        pending={deactivate.isPending}
        error={
          deactivate.isError ? getApiErrorMessage(deactivate.error).title : null
        }
        onConfirm={confirmDeactivation}
      >
        <p>
          سيتم تعطيل حساب{" "}
          <span className="identifier-ltr break-all font-semibold">
            {dialog?.user.email}
          </span>{" "}
          ولن يتمكن من تسجيل الدخول بعد الآن، وتنتهي جلساته الحالية. تبقى
          بياناته السابقة محفوظة.
        </p>
        <FormField
          label="سبب التعطيل"
          required
          htmlFor="deactivation-reason"
          hint="يُسجَّل السبب في سجل التدقيق."
        >
          <textarea
            id="deactivation-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={REASON_MAX_LENGTH}
            rows={3}
            className={inputClass}
          />
        </FormField>
      </SupportActionDialog>
    </DetailSection>
  );
}
