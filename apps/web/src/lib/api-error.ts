import { ApiError } from "@workspace/api-client-react";

export const FILE_TOO_LARGE_MESSAGE =
  "حجم الملف يتجاوز الحد الأقصى المسموح به وهو 10 ميغابايت.";

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

    if (body?.error?.code === "VEHICLE_UNAVAILABLE") {
      return {
        title:
          "لا يمكن بدء الصيانة لأن المركبة مرتبطة بإيجار قائم أو غير متاحة حالياً.",
      };
    }

    if (body?.error?.code === "INVALID_RENTAL_STATE") {
      return { title: "لا يمكن إنشاء العقد إلا للإيجار المحجوز أو النشط." };
    }

    if (body?.error?.code === "FILE_TOO_LARGE") {
      return { title: FILE_TOO_LARGE_MESSAGE };
    }

    if (body?.error?.message) {
      return { title: body.error.message };
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

    return { title: error.message || "حدث خطأ في الاتصال." };
  }

  return { title: "حدث خطأ في الاتصال بالخادم." };
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
