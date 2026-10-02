import { useState } from "react";
import { cn } from "@/lib/utils";
import { useOffline, type OfflineStatus } from "../OfflineProvider";
import { SyncResolutionDialog } from "./SyncResolutionDialog";

const statusConfig: Record<
  Exclude<OfflineStatus, "upToDate" | "pending">,
  { label: string; className: string }
> = {
  offline: { label: "غير متصل", className: "border-status-warning/25 bg-status-warning-bg text-status-warning" },
  synchronizing: { label: "جارٍ مزامنة التغييرات", className: "border-status-info/25 bg-status-info-bg text-status-info" },
  failed: { label: "تعذرت المزامنة", className: "border-status-danger/25 bg-status-danger-bg text-status-danger" },
  conflict: { label: "تحتاج التغييرات إلى مراجعة", className: "border-status-danger/25 bg-status-danger-bg text-status-danger" },
  authenticationRequired: { label: "يلزم تسجيل الدخول", className: "border-status-danger/25 bg-status-danger-bg text-status-danger" },
  organizationUnavailable: { label: "الحساب غير متاح", className: "border-status-danger/25 bg-status-danger-bg text-status-danger" },
};

export function SyncStatus() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const {
    status,
    pendingCount,
    workspace,
    store,
    refreshProjections,
    syncNow,
  } = useOffline();

  if (status === "upToDate") return null;

  const config = status === "pending"
    ? {
        label: pendingCount ? `${pendingCount} تغييرات بانتظار المزامنة` : "جاهز للمزامنة",
        className: "border-status-warning/25 bg-status-warning-bg text-status-warning",
      }
    : statusConfig[status];

  const canResolve = status === "conflict" || status === "failed";
  if (canResolve || status === "offline") {
    return (
      <>
        <button
          type="button"
          className={cn(
            "ui-badge-text inline-flex min-h-11 items-center rounded-md border px-2 py-0.5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:min-h-6",
            config.className,
          )}
          aria-label={config.label}
          data-state={status}
          onClick={() => (status === "offline" ? syncNow() : setDialogOpen(true))}
        >
          {config.label}
        </button>
        {canResolve && <SyncResolutionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          workspace={workspace}
          store={store}
          refreshProjections={refreshProjections}
          syncNow={syncNow}
        />}
      </>
    );
  }

  return (
    <p
      aria-atomic="true"
      aria-label={config.label}
      aria-live="polite"
      className={cn(
        "ui-badge-text inline-flex min-h-6 items-center rounded-md border px-2 py-0.5 shadow-sm",
        config.className,
      )}
      data-state={status}
      role="status"
    >
      {config.label}
    </p>
  );
}
