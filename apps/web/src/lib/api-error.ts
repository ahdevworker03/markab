import { ApiError } from "@workspace/api-client-react";

export const FILE_TOO_LARGE_MESSAGE =
  "حجم الملف يتجاوز الحد الأقصى المسموح به وهو 10 ميغابايت.";

const API_ERROR_MESSAGES: Record<string, string> = {
  ACCOUNT_DEACTIVATED: "تم إيقاف هذا الحساب.",
  ACTIVE_RENTAL_CANNOT_BE_DELETED: "لا يمكن حذف إيجار نشط.",
  AUTHENTICATION_REQUIRED: "سجّل الدخول للمتابعة.",
  CANNOT_DELETE_ORGANIZATION: "لا يمكن حذف المؤسسة.",
  CANNOT_DELETE_SELF: "لا يمكنك حذف حسابك.",
  CONTRACT_EXISTS: "يوجد عقد لهذا الإيجار بالفعل.",
  CONTRACT_NOT_FOUND: "لم يتم العثور على العقد.",
  CUSTOMER_DATA_INTEGRITY_ERROR: "تعذر حفظ بيانات العميل. حاول مرة أخرى.",
  CUSTOMER_NOT_FOUND: "لم يتم العثور على العميل.",
  DOCUMENT_NOT_FOUND: "لم يتم العثور على المستند.",
  DUPLICATE_CUSTOMER: "يوجد عميل مسجل بهذه البيانات بالفعل.",
  DUPLICATE_PLATE: "رقم اللوحة مستخدم لمركبة أخرى.",
  EMAIL_ALREADY_EXISTS: "البريد الإلكتروني مستخدم بالفعل.",
  EMPTY_FILE: "لا يمكن رفع ملف فارغ.",
  EXPENSE_NOT_FOUND: "لم يتم العثور على المصروف.",
  EXPIRED_REFRESH_TOKEN: "انتهت الجلسة. سجّل الدخول مرة أخرى.",
  FILE_NOT_FOUND: "الملف المطلوب لم يعد متاحًا.",
  FILE_REQUIRED: "اختر ملفًا للرفع.",
  FILE_TOO_LARGE: FILE_TOO_LARGE_MESSAGE,
  INSUFFICIENT_PERMISSIONS: "ليس لديك صلاحية لتنفيذ هذا الإجراء.",
  INTERNAL_ERROR: "حدث خطأ غير متوقع. حاول مرة أخرى لاحقًا.",
  INVALID_ACCESS_TOKEN: "انتهت الجلسة. سجّل الدخول مرة أخرى.",
  INVALID_CREDENTIALS: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  INVALID_EXPENSE_AMOUNT: "أدخل مبلغ مصروف صحيحًا.",
  INVALID_EXPENSE_CATEGORY: "فئة المصروف غير صالحة.",
  INVALID_FILE_SIGNATURE: "محتوى الملف لا يطابق نوعه.",
  INVALID_MAINTENANCE_COST: "أدخل تكلفة صيانة صحيحة.",
  INVALID_MAINTENANCE_SCHEDULE: "إعدادات جدول الصيانة غير صالحة.",
  INVALID_MAINTENANCE_TRANSITION: "لا يمكن تغيير حالة الصيانة بهذه الطريقة.",
  INVALID_OR_EXPIRED_INVITATION: "رابط الدعوة غير صالح أو منتهي الصلاحية.",
  INVALID_OR_EXPIRED_PASSWORD_RESET_TOKEN:
    "رابط إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية.",
  INVALID_ORIGIN: "مصدر الطلب غير مسموح به.",
  INVALID_PAYMENT_AMOUNT: "أدخل مبلغ دفعة صحيحًا.",
  INVALID_PAYMENT_METHOD: "طريقة الدفع غير صالحة.",
  INVALID_REFRESH_TOKEN: "انتهت الجلسة. سجّل الدخول مرة أخرى.",
  INVALID_RENTAL_AMOUNTS: "تفاصيل مبالغ الإيجار غير صالحة.",
  INVALID_RENTAL_EXTENSION: "لا يمكن تمديد الإيجار إلى هذا التاريخ.",
  INVALID_RENTAL_PERIOD: "فترة الإيجار غير صالحة.",
  INVALID_RENTAL_STATE: "لا يمكن إنشاء العقد إلا للإيجار المحجوز أو النشط.",
  INVALID_RENTAL_TRANSITION: "لا يمكن تغيير حالة الإيجار بهذه الطريقة.",
  INVALID_REPLACED_PART: "بيانات القطعة المستبدلة غير صالحة.",
  INVALID_TOKEN: "انتهت الجلسة. سجّل الدخول مرة أخرى.",
  INVALID_TOKEN_FORMAT: "تنسيق جلسة الدخول غير صالح.",
  MAINTENANCE_NOT_FOUND: "لم يتم العثور على سجل الصيانة.",
  MAINTENANCE_SCHEDULE_NOT_FOUND: "لم يتم العثور على جدول الصيانة.",
  MALFORMED_JSON: "تعذر قراءة البيانات المرسلة.",
  NOT_FOUND: "لم يتم العثور على المورد المطلوب.",
  ORGANIZATION_NOT_FOUND: "لم يتم العثور على المؤسسة.",
  ORGANIZATION_NOT_OPERATIONAL: "المؤسسة غير مفعلة حالياً.",
  OWNER_ROLE_CHANGE_NOT_SUPPORTED: "لا يمكن تغيير دور المالك.",
  PAYLOAD_TOO_LARGE: "البيانات المرسلة أكبر من الحد المسموح به.",
  PAYMENT_EXCEEDS_OUTSTANDING_BALANCE:
    "لا يمكن أن تتجاوز الدفعة الرصيد المستحق.",
  PHOTO_NOT_FOUND: "لم يتم العثور على الصورة.",
  RATE_LIMITED: "تم إرسال طلبات كثيرة. حاول مرة أخرى بعد قليل.",
  RENTAL_MISSING_RELATIONS: "تعذر إنشاء العقد لعدم اكتمال بيانات الإيجار.",
  RENTAL_NOT_FOUND: "لم يتم العثور على الإيجار.",
  REQUEST_TIMEOUT: "انتهت مهلة الطلب. حاول مرة أخرى.",
  SIGNED_CONTRACT_EXISTS: "تم رفع نسخة موقعة من العقد بالفعل.",
  TASK_ALREADY_COMPLETED: "المهمة مكتملة بالفعل.",
  TASK_NOT_FOUND: "لم يتم العثور على المهمة.",
  TASK_RECURRENCE_CANNOT_CHANGE_AFTER_COMPLETION:
    "لا يمكن تغيير تكرار مهمة مكتملة.",
  TASK_RECURRENCE_INVALID: "إعدادات تكرار المهمة غير صالحة.",
  TENANT_ACCESS_REQUIRED: "اختر مؤسسة للمتابعة.",
  UNSUPPORTED_MEDIA_TYPE: "نوع البيانات المرسلة غير مدعوم.",
  UNSUPPORTED_MIME_TYPE: "نوع الملف غير مدعوم.",
  UPLOAD_ERROR: "تعذر رفع الملف. حاول مرة أخرى.",
  USER_NOT_FOUND: "لم يتم العثور على المستخدم.",
  VALIDATION_ERROR: "تحقق من البيانات المدخلة ثم حاول مرة أخرى.",
  VEHICLE_NOT_FOUND: "لم يتم العثور على المركبة.",
  VEHICLE_UNAVAILABLE:
    "لا يمكن بدء الصيانة لأن السيارة مرتبطة بإيجار قائم أو غير متاحة حالياً.",
};

export interface ApiErrorMessage {
  title: string;
  description?: string;
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

function extractBody(error: unknown): ApiErrorBody | null {
  if (error instanceof ApiError) {
    return (error.data ?? null) as ApiErrorBody | null;
  }
  return null;
}

export function getApiErrorMessage(error: unknown): ApiErrorMessage {
  if (error instanceof ApiError) {
    const body = extractBody(error);
    const errorMessage = body?.error?.code
      ? API_ERROR_MESSAGES[body.error.code]
      : undefined;

    if (errorMessage) {
      return { title: errorMessage };
    }

    if (error.status >= 500) {
      return { title: "حدث خطأ غير متوقع. حاول مرة أخرى لاحقًا." };
    }

    if (error.status === 401) {
      return { title: "انتهت الجلسة. سجّل الدخول مرة أخرى." };
    }

    if (error.status === 403) {
      return { title: "ليس لديك صلاحية لتنفيذ هذا الإجراء." };
    }

    return { title: "تعذر تنفيذ الطلب. حاول مرة أخرى." };
  }

  return { title: "حدث خطأ في الاتصال بالخادم." };
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
