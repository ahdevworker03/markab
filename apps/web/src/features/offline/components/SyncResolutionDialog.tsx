import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createOfflineCommands } from "../commands";
import type { OfflineStore, OfflineWorkspace, QueuedOperation } from "../types";

type SyncResolutionDialogProps = {
  open: boolean;
  onOpenChange(open: boolean): void;
  workspace: OfflineWorkspace | null;
  store: OfflineStore;
  refreshProjections(): void;
  syncNow(): void;
};

const actionRequired = (operation: QueuedOperation): boolean =>
  operation.state === "CONFLICT" ||
  operation.state === "REJECTED" ||
  operation.state === "EXPIRED";

function operationLabel(operation: QueuedOperation): string {
  const action = {
    CUSTOMER_CREATE: "إنشاء العميل",
    CUSTOMER_UPDATE: "تعديل العميل",
    RENTAL_CREATE: "إنشاء الإيجار",
  }[operation.type];

  if (operation.state === "CONFLICT") return `تعارض في ${action}`;
  if (operation.state === "REJECTED") return `تعذر تنفيذ ${action}`;
  return `انتهت صلاحية ${action}`;
}

export function SyncResolutionDialog({
  open,
  onOpenChange,
  workspace,
  store,
  refreshProjections,
  syncNow,
}: SyncResolutionDialogProps) {
  const [operations, setOperations] = useState<QueuedOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<string>();
  const [error, setError] = useState<string>();
  const loadRequest = useRef(0);

  const loadOperations = async () => {
    const request = ++loadRequest.current;
    if (!workspace) {
      if (request === loadRequest.current) {
        setOperations([]);
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const operations = await store.listOutbox(workspace, 2 ** 32 - 1);
      if (request === loadRequest.current) {
        setOperations(operations.filter(actionRequired));
      }
    } catch {
      if (request === loadRequest.current) {
        setError("تعذر تحميل التغييرات التي تحتاج إلى مراجعة. حاول مرة أخرى.");
      }
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    setOperations([]);
    setError(undefined);
    if (open) void loadOperations();
  }, [open, workspace?.organizationId, workspace?.userId]);

  const resolve = async (
    operation: QueuedOperation,
    action: "reapply" | "discard",
  ) => {
    if (!workspace) return;
    setPendingOperation(operation.operation_id);
    setError(undefined);
    try {
      const commands = createOfflineCommands({ workspace, store });
      if (action === "reapply") {
        const customer = operation.result?.current_customer;
        if (!customer) throw new Error("Missing retained customer");
        await commands.reapplyCustomerConflict(operation.operation_id, customer);
        syncNow();
      } else if (operation.state === "CONFLICT") {
        await commands.discardCustomerConflict(operation.operation_id);
      } else {
        await commands.discardFailedOperation(operation.operation_id);
      }
      refreshProjections();
      await loadOperations();
    } catch {
      setError("تعذر حفظ قرارك. حاول مرة أخرى.");
    } finally {
      setPendingOperation(undefined);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel="إغلاق" dir="rtl" className="max-w-lg text-right">
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle>مراجعة التغييرات</DialogTitle>
          <DialogDescription>
            اختر طريقة التعامل مع كل تغيير قبل متابعة المزامنة.
          </DialogDescription>
        </DialogHeader>

        {loading ? <p role="status">جارٍ تحميل التغييرات.</p> : null}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        {!loading && !error && operations.length === 0 ? (
          <p role="status" className="text-sm text-muted-foreground">
            لا توجد تغييرات تحتاج إلى مراجعة.
          </p>
        ) : null}

        <div className="space-y-3">
          {operations.map((operation) => {
            const canReapply =
              operation.state === "CONFLICT" &&
              operation.type === "CUSTOMER_UPDATE" &&
              operation.result?.current_customer;
            const busy = pendingOperation === operation.operation_id;

            return (
              <section
                key={operation.operation_id}
                className="space-y-3 rounded-lg border p-4"
                aria-label={operationLabel(operation)}
              >
                <div>
                  <h3 className="font-semibold">{operationLabel(operation)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {operation.state === "CONFLICT"
                      ? "توجد نسخة أحدث على الخادم."
                      : "لن تتم إعادة محاولة هذا التغيير تلقائيًا."}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-start">
                  {canReapply ? (
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => void resolve(operation, "reapply")}
                    >
                      إعادة تطبيق التغيير
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant={canReapply ? "outline" : "destructive"}
                    disabled={busy}
                    onClick={() => void resolve(operation, "discard")}
                  >
                    {operation.state === "CONFLICT"
                      ? "اعتماد نسخة الخادم"
                      : "تجاهل التغيير"}
                  </Button>
                </div>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
