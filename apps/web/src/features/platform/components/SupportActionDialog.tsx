import type { ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineError } from "@/components/ui/FeedbackState";
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

interface SupportActionDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  confirmLabel: string;
  onConfirm: () => void;
  pending: boolean;
  error: string | null;
  destructive?: boolean;
  confirmDisabled?: boolean;
  children: ReactNode;
}

/** Confirmation dialog whose failure feedback renders inside the dialog, not behind its overlay. */
export function SupportActionDialog({
  open,
  onClose,
  title,
  confirmLabel,
  onConfirm,
  pending,
  error,
  destructive = false,
  confirmDisabled = false,
  children,
}: SupportActionDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <AlertDialogContent dir="rtl" className="max-h-[90dvh] max-w-md overflow-y-auto">
        <AlertDialogHeader className="text-start sm:text-start">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">{children}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <InlineError>{error}</InlineError>}
        <AlertDialogFooter className="gap-2 sm:space-x-0">
          <AlertDialogCancel disabled={pending}>رجوع</AlertDialogCancel>
          <AlertDialogAction
            asChild
            className={destructive ? buttonVariants({ variant: "destructive" }) : undefined}
          >
            <Button
              type="button"
              variant={destructive ? "destructive" : "default"}
              disabled={pending || confirmDisabled}
              onClick={(event) => {
                event.preventDefault();
                onConfirm();
              }}
            >
              {pending ? "جارٍ التنفيذ" : confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
