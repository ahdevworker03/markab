import { ApiError } from "@workspace/api-client-react";
import { describe, expect, it } from "vitest";
import { getApiErrorMessage } from "./api-error";

function apiError(code: string, status = 422) {
  return new ApiError(
    new Response(null, { status, statusText: "Error" }),
    { error: { code, message: "English backend message" } },
    { method: "POST", url: "/api/test" },
  );
}

describe("getApiErrorMessage", () => {
  it("localizes representative authentication errors", () => {
    expect(getApiErrorMessage(apiError("INVALID_CREDENTIALS", 401)).title).toBe(
      "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    );
  });

  it("localizes rental lifecycle and availability errors", () => {
    expect(
      getApiErrorMessage(apiError("INVALID_RENTAL_STATE", 409)).title,
    ).toBe("لا يمكن إنشاء العقد إلا للإيجار المحجوز أو النشط.");
    expect(getApiErrorMessage(apiError("VEHICLE_UNAVAILABLE", 409)).title).toBe(
      "لا يمكن بدء الصيانة لأن المركبة مرتبطة بإيجار قائم أو غير متاحة حالياً.",
    );
  });

  it("localizes missing, oversized, forbidden, and not-found file errors", () => {
    expect(getApiErrorMessage(apiError("FILE_NOT_FOUND", 404)).title).toBe(
      "الملف المطلوب لم يعد متاحًا.",
    );
    expect(getApiErrorMessage(apiError("FILE_TOO_LARGE")).title).toBe(
      "حجم الملف يتجاوز الحد الأقصى المسموح به وهو 10 ميغابايت.",
    );
    expect(
      getApiErrorMessage(apiError("INSUFFICIENT_PERMISSIONS", 403)).title,
    ).toBe("ليس لديك صلاحية لتنفيذ هذا الإجراء.");
    expect(getApiErrorMessage(apiError("VEHICLE_NOT_FOUND", 404)).title).toBe(
      "لم يتم العثور على المركبة.",
    );
  });

  it("does not expose unknown server messages", () => {
    expect(getApiErrorMessage(apiError("UNKNOWN_CODE", 500)).title).toBe(
      "حدث خطأ غير متوقع. حاول مرة أخرى لاحقًا.",
    );
  });

  it("uses a safe Arabic fallback for network errors", () => {
    expect(getApiErrorMessage(new TypeError("Failed to fetch")).title).toBe(
      "حدث خطأ في الاتصال بالخادم.",
    );
  });
});
