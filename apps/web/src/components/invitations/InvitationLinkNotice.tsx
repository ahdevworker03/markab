import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineFeedback } from "@/components/ui/FeedbackState";
import { formatDate } from "@/lib/format";
import { buildInvitationUrl } from "./invitationLink";

export interface IssuedInvitation {
  email: string;
  expiresAt: string;
  acceptanceToken: string;
}

interface InvitationLinkNoticeProps {
  invitation: IssuedInvitation;
  onDismiss: () => void;
  /** "resent" also states that the previous link stopped working. */
  variant?: "created" | "resent";
}

/** One-time display of the employee invitation link; the token lives only in this component's props. */
export function InvitationLinkNotice({
  invitation,
  onDismiss,
  variant = "created",
}: InvitationLinkNoticeProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const link = buildInvitationUrl(invitation.acceptanceToken);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <InlineFeedback variant="success" className="flex-col">
      <div className="space-y-3">
        <p className="font-semibold">
          {variant === "resent" ? "تمت إعادة إصدار دعوة الموظف" : "تم إنشاء دعوة الموظف"}{" "}
          <span className="identifier-ltr break-all">{invitation.email}</span>
        </p>
        {variant === "resent" && (
          <p>الرابط السابق لم يعد صالحاً.</p>
        )}
        <p>
          شارك هذا الرابط مع الموظف عبر وسيلة تواصل آمنة. يظهر مرة واحدة فقط،
          وينتهي في {formatDate(invitation.expiresAt)}. إنشاء دعوة جديدة لنفس
          البريد يلغي هذا الرابط.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            dir="ltr"
            aria-label="رابط الدعوة"
            value={link}
            onFocus={(event) => event.currentTarget.select()}
            className="min-h-11 w-full min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
          />
          <Button type="button" variant="outline" onClick={() => void copy()}>
            {copyState === "copied" ? (
              <Check className="me-2 size-4" aria-hidden="true" />
            ) : (
              <Copy className="me-2 size-4" aria-hidden="true" />
            )}
            {copyState === "copied" ? "تم النسخ" : "نسخ الرابط"}
          </Button>
        </div>
        {copyState === "failed" && (
          <p role="alert" className="text-destructive">
            تعذر النسخ تلقائياً. حدد الرابط وانسخه يدوياً.
          </p>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          تم، إخفاء الرابط
        </Button>
      </div>
    </InlineFeedback>
  );
}
