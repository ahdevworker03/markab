import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import { PaymentSection } from "./PaymentSection";
import { ApiError, type PaymentResponse } from "@workspace/api-client-react";
import { renderAtFixedDate as render, withFixedDate } from "@/test/render-at-fixed-date";
import { formatDateTime } from "@/lib/format";

vi.mock("@/features/payments/hooks", () => ({
  useRentalPayments: vi.fn(),
  usePaymentMutations: vi.fn(),
}));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

import {
  useRentalPayments,
  usePaymentMutations,
} from "@/features/payments/hooks";
import { useAuth } from "@/providers/AuthProvider";

function selectDate(date: string) {
  fireEvent.click(screen.getByLabelText(/تاريخ الدفع/));
  if (!document.querySelector(`button[data-day="${date}"]`)) {
    fireEvent.click(document.querySelector("button.rdp-button_previous")!);
  }
  fireEvent.click(document.querySelector(`button[data-day="${date}"]`)!);
}

const mockedUseRentalPayments = vi.mocked(useRentalPayments);
const mockedUsePaymentMutations = vi.mocked(usePaymentMutations);
const mockedUseAuth = vi.mocked(useAuth);

function makePayment(overrides: Partial<PaymentResponse>): PaymentResponse {
  return {
    id: "p1",
    rentalId: "r1",
    amount: 50,
    paymentDate: "2026-08-15T12:00:00Z",
    method: "CASH",
    createdAt: "2026-08-15T12:00:00Z",
    updatedAt: "2026-08-15T12:00:00Z",
    ...overrides,
  };
}

function mockOwner() {
  mockedUseAuth.mockReturnValue({
    user: { role: "OWNER" },
  } as ReturnType<typeof useAuth>);
}

function mockEmployee() {
  mockedUseAuth.mockReturnValue({
    user: { role: "EMPLOYEE" },
  } as ReturnType<typeof useAuth>);
}

function makeApiError(message: string, code = "ERROR"): ApiError {
  const response = new Response(null, {
    status: 400,
    statusText: "Bad Request",
  });
  return new ApiError(
    response,
    { error: { code, message } },
    { method: "GET", url: "/api/rentals/r1/payments" },
  );
}

function mockData(payments: PaymentResponse[], outstandingBalance: number) {
  mockedUseRentalPayments.mockReturnValue({
    isLoading: false,
    isError: false,
    error: null,
    data: { payments, outstandingBalance },
  } as unknown as ReturnType<typeof useRentalPayments>);
}

function mockCreate() {
  const create = {
    isPending: false,
    mutateAsync: vi.fn().mockResolvedValue(undefined),
  };
  mockedUsePaymentMutations.mockReturnValue({
    create,
  } as unknown as ReturnType<typeof usePaymentMutations>);
  return create;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockOwner();
  mockCreate();
});

describe("PaymentSection", () => {
  it("shows a structured loading state while payments are loading", () => {
    mockedUseRentalPayments.mockReturnValue({
      isLoading: true,
      isError: false,
      error: null,
      data: { payments: [], outstandingBalance: 0 },
    } as unknown as ReturnType<typeof useRentalPayments>);

    render(<PaymentSection rentalId="r1" />);
    expect(screen.getByLabelText("جارٍ تحميل البيانات")).toBeInTheDocument();
  });

  it("shows an error message when loading fails", () => {
    mockedUseRentalPayments.mockReturnValue({
      isLoading: false,
      isError: true,
      error: makeApiError("فشل تحميل المدفوعات"),
      data: { payments: [], outstandingBalance: 0 },
    } as unknown as ReturnType<typeof useRentalPayments>);

    render(<PaymentSection rentalId="r1" />);
    expect(
      screen.getByText("تعذر تنفيذ الطلب. حاول مرة أخرى."),
    ).toBeInTheDocument();
  });

  it("shows the outstanding balance and an empty state when there are no payments", () => {
    mockData([], 120);

    render(<PaymentSection rentalId="r1" />);

    expect(screen.getByText("المتبقي")).toBeInTheDocument();
    expect(screen.getByText("USD 120")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "لا توجد مدفوعات مسجلة",
    );
  });

  it("renders payment history entries with amount, date, and method label", () => {
    mockData(
      [
        makePayment({
          id: "p1",
          amount: 50,
          method: "CASH",
          paymentDate: "2026-08-15T12:00:00Z",
        }),
        makePayment({
          id: "p2",
          amount: 70,
          method: "TRANSFER",
          paymentDate: "2026-08-20T12:00:00Z",
        }),
      ],
      0,
    );

    render(<PaymentSection rentalId="r1" />);

    expect(screen.getByText("USD 50")).toBeInTheDocument();
    expect(screen.getByText("USD 70")).toBeInTheDocument();
    expect(screen.getAllByText("نقداً").length).toBeGreaterThan(0);
    expect(screen.getAllByText("تحويل بنكي").length).toBeGreaterThan(0);
  });

  it("keeps each payment record in a responsive date, method, and amount grid", () => {
    mockData([makePayment({ method: "TRANSFER" })], 0);

    render(<PaymentSection rentalId="r1" />);

    const row = screen.getByText("تاريخ الدفع").closest("dl");
    expect(row).not.toBeNull();
    expect(row).toHaveAttribute("dir", "rtl");
    expect(row!).toHaveClass(
      "grid-cols-1",
      "gap-y-1",
      "py-2",
      "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]",
      "sm:gap-y-3",
      "sm:py-3",
    );
    expect(row!).not.toHaveClass(
      "justify-between",
      "mt-auto",
      "min-h-full",
      "min-h-screen",
    );
    const dateField = within(row!).getByText("تاريخ الدفع").closest("div");
    const methodField = within(row!).getByText("تحويل بنكي").closest("div");
    const amountField = within(row!).getByText("USD 50").closest("div");

    expect(dateField?.querySelector("dt")).toHaveTextContent("تاريخ الدفع");
    expect(dateField?.querySelector("dd")).toHaveTextContent(
      formatDateTime("2026-08-15T12:00:00Z"),
    );
    expect(dateField).toHaveClass(
      "flex",
      "min-w-0",
      "items-baseline",
      "justify-between",
      "gap-3",
      "sm:block",
      "sm:col-start-1",
    );
    expect(dateField?.querySelector("dd")).toHaveClass(
      "m-0",
      "min-w-0",
      "number-ltr",
      "text-end",
      "sm:mt-1",
    );
    expect(methodField?.querySelector("dt")).toHaveTextContent("الطريقة");
    expect(methodField?.querySelector("dd")).toHaveTextContent("تحويل بنكي");
    expect(methodField?.querySelector("dd")).toHaveClass(
      "m-0",
      "min-w-0",
      "break-words",
      "sm:mt-1",
    );
    expect(methodField).toHaveClass(
      "flex",
      "min-w-0",
      "items-baseline",
      "justify-between",
      "gap-3",
      "sm:block",
      "sm:col-start-2",
    );
    expect(amountField?.querySelector("dt")).toHaveTextContent("المبلغ");
    expect(amountField?.querySelector("dd")).toHaveTextContent("USD 50");
    expect(amountField?.querySelector("dd")).toHaveClass(
      "m-0",
      "min-w-0",
      "number-ltr",
      "whitespace-nowrap",
      "sm:mt-1",
    );
    expect(amountField).toHaveClass(
      "flex",
      "min-w-0",
      "items-baseline",
      "justify-between",
      "gap-3",
      "text-end",
      "sm:block",
      "sm:col-start-3",
      "sm:justify-self-end",
    );
  });

  it("records a payment and shows a success message", async () => {
    const create = mockCreate();
    mockData([], 120);

    render(<PaymentSection rentalId="r1" />);

    withFixedDate(() =>
      fireEvent.click(screen.getByRole("button", { name: /تسجيل دفعة/ })),
    );

    fireEvent.change(screen.getByLabelText(/المبلغ/), {
      target: { value: "50" },
    });
    selectDate("2026-08-15");
    fireEvent.change(screen.getByLabelText(/طريقة الدفع/), {
      target: { value: "CASH" },
    });

    fireEvent.click(screen.getByText("تسجيل الدفعة"));

    await waitFor(() => {
      expect(create.mutateAsync).toHaveBeenCalledWith({
        rentalId: "r1",
        data: {
          amount: 50,
          payment_date: "2026-08-15T12:00:00.000Z",
          method: "CASH",
        },
      });
    });

    expect(screen.getByText("تم تسجيل الدفعة.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "إغلاق" }));
    expect(screen.queryByText("تم تسجيل الدفعة.")).not.toBeInTheDocument();
  });

  it("validates required fields before submitting", async () => {
    const create = mockCreate();
    mockData([], 120);

    render(<PaymentSection rentalId="r1" />);

    fireEvent.click(screen.getByRole("button", { name: /تسجيل دفعة/ }));
    fireEvent.click(screen.getByText("تسجيل الدفعة"));

    expect(await screen.findByText("أدخل مبلغاً صحيحاً.")).toBeInTheDocument();
    expect(screen.getByText("أدخل تاريخ الدفع.")).toBeInTheDocument();
    expect(screen.getByText("اختر طريقة الدفع.")).toBeInTheDocument();
    expect(create.mutateAsync).not.toHaveBeenCalled();
  });

  it("rejects a zero or negative amount", async () => {
    mockData([], 120);
    render(<PaymentSection rentalId="r1" />);

    fireEvent.click(screen.getByRole("button", { name: /تسجيل دفعة/ }));
    fireEvent.change(screen.getByLabelText(/المبلغ/), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByText("تسجيل الدفعة"));

    expect(
      await screen.findByText("أدخل مبلغاً أكبر من صفر."),
    ).toBeInTheDocument();
  });

  it("shows localized feedback when a payment exceeds the outstanding balance", async () => {
    const create = mockCreate();
    create.mutateAsync.mockRejectedValue(
      makeApiError(
        "Outstanding balance exceeded",
        "PAYMENT_EXCEEDS_OUTSTANDING_BALANCE",
      ),
    );
    mockData([], 120);

    render(<PaymentSection rentalId="r1" />);

    withFixedDate(() =>
      fireEvent.click(screen.getByRole("button", { name: /تسجيل دفعة/ })),
    );
    fireEvent.change(screen.getByLabelText(/المبلغ/), {
      target: { value: "50" },
    });
    selectDate("2026-08-15");
    fireEvent.change(screen.getByLabelText(/طريقة الدفع/), {
      target: { value: "CASH" },
    });
    fireEvent.click(screen.getByText("تسجيل الدفعة"));

    expect(
      await screen.findByText("لا يمكن أن تتجاوز الدفعة الرصيد المستحق."),
    ).toBeInTheDocument();
  });

  it("hides the record-payment button for non-owner users", () => {
    mockEmployee();
    mockData([], 120);

    render(<PaymentSection rentalId="r1" />);

    expect(
      screen.queryByRole("button", { name: /تسجيل دفعة/ }),
    ).not.toBeInTheDocument();
  });
});
