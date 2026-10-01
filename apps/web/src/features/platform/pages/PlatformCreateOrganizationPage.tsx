import { useState, type FormEvent } from "react";
import { ChevronRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  useCreatePlatformOrganization,
  type PlatformInitialOrganizationStatus,
} from "@workspace/api-client-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineError } from "@/components/ui/FeedbackState";
import { FormField, inputClass } from "@/components/ui/FormField";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SectionCard } from "@/components/ui/SectionCard";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";

const NAME_MAX_LENGTH = 200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const statusOptions: ReadonlyArray<{
  value: PlatformInitialOrganizationStatus;
  label: string;
  hint: string;
}> = [
  { value: "ACTIVE", label: "نشط", hint: "الخيار المعتاد للعملاء المعتمدين." },
  {
    value: "TRIAL",
    label: "تجريبي",
    hint: "له حالياً نفس صلاحيات التشغيل، دون مدة تجريبية محددة.",
  },
];

interface FieldErrors {
  organizationName?: string;
  ownerEmail?: string;
}

function errorCode(error: unknown): string | undefined {
  return (error as { data?: { error?: { code?: string } } } | null)?.data?.error
    ?.code;
}

export default function PlatformCreateOrganizationPage() {
  const [, setLocation] = useLocation();
  const [organizationName, setOrganizationName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [initialStatus, setInitialStatus] =
    useState<PlatformInitialOrganizationStatus>("ACTIVE");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const mutation = useCreatePlatformOrganization();
  const submitting = mutation.isPending;

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!organizationName.trim()) next.organizationName = "اسم المؤسسة مطلوب.";
    if (!ownerEmail.trim()) {
      next.ownerEmail = "البريد الإلكتروني للمالك مطلوب.";
    } else if (!EMAIL_PATTERN.test(ownerEmail.trim())) {
      next.ownerEmail = "أدخل بريداً إلكترونياً صحيحاً.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !validate()) return;
    setFormError(null);

    const payload = {
      organizationName: organizationName.trim(),
      ownerEmail: ownerEmail.trim(),
      initialStatus,
    };

    try {
      const response = await mutation.mutateAsync({ data: payload });
      toast({
        title: "تم إنشاء المؤسسة وحساب المالك",
        description:
          "تم طلب إرسال رابط إعداد كلمة المرور إلى بريد المالك. إن لم يصل الرابط، اطلب رابطاً جديداً من قسم مستخدمي المؤسسة.",
      });
      setLocation(`/platform/organizations/${response.data.organization.id}`);
    } catch (error) {
      if (errorCode(error) === "EMAIL_ALREADY_EXISTS") {
        setErrors((current) => ({
          ...current,
          ownerEmail: "هذا البريد الإلكتروني مرتبط بحساب موجود بالفعل. استخدم بريداً آخر.",
        }));
        return;
      }
      setFormError(getApiErrorMessage(error).title);
    }
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
        <h1 className="ui-page-title">إضافة مؤسسة</h1>
        <p className="ui-secondary-text max-w-xl">
          أنشئ مؤسسة عميلة وحساب مالكها الأول. يحدّد المالك كلمة مروره بنفسه عبر
          رابط يُطلب إرساله إلى بريده.
        </p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="max-w-xl">
        <SectionCard title="بيانات المؤسسة">
          <div className="space-y-5">
            {formError && (
              <InlineError className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                {formError}
              </InlineError>
            )}

            <FormField
              label="اسم المؤسسة"
              required
              htmlFor="organization-name"
              error={errors.organizationName}
            >
              <input
                id="organization-name"
                value={organizationName}
                onChange={(event) => {
                  setOrganizationName(event.target.value);
                  if (errors.organizationName)
                    setErrors((current) => ({ ...current, organizationName: undefined }));
                }}
                maxLength={NAME_MAX_LENGTH}
                autoComplete="off"
                aria-invalid={!!errors.organizationName}
                disabled={submitting}
                className={inputClass}
              />
            </FormField>

            <FormField
              label="البريد الإلكتروني لمالك المؤسسة"
              required
              htmlFor="owner-email"
              hint="يُطلب إرسال رابط تعيين كلمة المرور إلى هذا البريد."
              error={errors.ownerEmail}
            >
              <input
                id="owner-email"
                type="email"
                dir="ltr"
                value={ownerEmail}
                onChange={(event) => {
                  setOwnerEmail(event.target.value);
                  if (errors.ownerEmail)
                    setErrors((current) => ({ ...current, ownerEmail: undefined }));
                }}
                autoComplete="off"
                aria-invalid={!!errors.ownerEmail}
                disabled={submitting}
                className={inputClass}
              />
            </FormField>

            <div className="space-y-2">
              <p id="initial-status-label" className="ui-label font-semibold">
                الحالة الأولية <span className="ms-1 text-destructive">*</span>
              </p>
              <RadioGroup
                dir="rtl"
                aria-labelledby="initial-status-label"
                value={initialStatus}
                onValueChange={(value) =>
                  setInitialStatus(value as PlatformInitialOrganizationStatus)
                }
                disabled={submitting}
              >
                {statusOptions.map((option) => (
                  <Label
                    key={option.value}
                    htmlFor={`initial-status-${option.value}`}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-3 transition-colors hover:bg-muted/50",
                      initialStatus === option.value &&
                        "border-primary/50 bg-primary/5",
                    )}
                  >
                    <RadioGroupItem
                      id={`initial-status-${option.value}`}
                      value={option.value}
                      className="mt-0.5"
                    />
                    <span className="space-y-0.5">
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {option.hint}
                      </span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-5 sm:flex-row">
              <Button type="submit" disabled={submitting} className="sm:min-w-40">
                {submitting ? "جارٍ الإنشاء" : "إنشاء المؤسسة"}
              </Button>
              <Link
                href="/platform"
                className={buttonVariants({ variant: "outline" })}
                aria-disabled={submitting}
              >
                إلغاء
              </Link>
            </div>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}
