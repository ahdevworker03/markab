import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationUsersSection } from "./OrganizationUsersSection";

const {
  useListPlatformOrganizationUsers,
  useResendPlatformEmployeeInvitation,
  useRequestPlatformOwnerPasswordReset,
  useDeactivatePlatformEmployee,
  invalidateQueries,
  refetch,
} = vi.hoisted(() => ({
  useListPlatformOrganizationUsers: vi.fn(),
  useResendPlatformEmployeeInvitation: vi.fn(),
  useRequestPlatformOwnerPasswordReset: vi.fn(),
  useDeactivatePlatformEmployee: vi.fn(),
  invalidateQueries: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));

vi.mock("@/lib/api-error", () => ({
  getApiErrorMessage: () => ({ title: "تعذر تنفيذ الطلب" }),
}));
vi.mock("@workspace/api-client-react", () => ({
  getListPlatformOrganizationUsersQueryKey: (id: string) => ["users", id],
  useListPlatformOrganizationUsers,
  useResendPlatformEmployeeInvitation,
  useRequestPlatformOwnerPasswordReset,
  useDeactivatePlatformEmployee,
}));

const LONG_EMAIL =
  "an.extremely.long.employee.address.for.layout.testing@very-long-subdomain.example-company-name.example.com";

const owner = {
  id: "u-owner",
  email: "owner@tenant.example",
  role: "OWNER",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  deactivatedAt: null,
};
const employee = {
  id: "u-emp",
  email: LONG_EMAIL,
  role: "EMPLOYEE",
  status: "ACTIVE",
  createdAt: "2026-02-01T00:00:00.000Z",
  deactivatedAt: null,
};
const deactivated = {
  id: "u-off",
  email: "gone@tenant.example",
  role: "EMPLOYEE",
  status: "DEACTIVATED",
  createdAt: "2026-03-01T00:00:00.000Z",
  deactivatedAt: "2026-04-01T00:00:00.000Z",
};
const pending = {
  id: "i-1",
  email: "pending@tenant.example",
  status: "PENDING",
  createdAt: "2026-05-01T00:00:00.000Z",
  expiresAt: "2026-05-08T00:00:00.000Z",
  acceptedAt: null,
};
const expired = {
  id: "i-2",
  email: "expired@tenant.example",
  status: "EXPIRED",
  createdAt: "2026-04-01T00:00:00.000Z",
  expiresAt: "2026-04-08T00:00:00.000Z",
  acceptedAt: null,
};

function idleMutation(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, ...overrides };
}

function ready(users: unknown[], invitations: unknown[]) {
  useListPlatformOrganizationUsers.mockReturnValue({
    data: { data: { users, invitations } },
    isPending: false,
    isError: false,
    refetch,
  });
}

function usersList() {
  return within(
    screen.getByRole("heading", { name: /الحسابات/ }).closest("section")!,
  );
}
function invitationsList() {
  return within(
    screen.getByRole("heading", { name: /الدعوات/ }).closest("section")!,
  );
}

describe("OrganizationUsersSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const hook of [
      useResendPlatformEmployeeInvitation,
      useRequestPlatformOwnerPasswordReset,
      useDeactivatePlatformEmployee,
    ]) {
      hook.mockReturnValue(idleMutation());
    }
  });

  it("requests the users of the given organization", () => {
    ready([owner], []);
    render(<OrganizationUsersSection organizationId="org-1" />);

    expect(useListPlatformOrganizationUsers).toHaveBeenCalledWith("org-1");
  });

  it("marks the owner and shows employees as plain rows", () => {
    ready([owner, employee], []);
    render(<OrganizationUsersSection organizationId="org-1" />);

    const rows = usersList().getAllByRole("listitem");
    expect(within(rows[0]!).getByText("owner@tenant.example")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("مالك المؤسسة")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("موظف")).toBeInTheDocument();
    expect(within(rows[1]!).queryByText("مالك المؤسسة")).not.toBeInTheDocument();
    expect(within(rows[0]!).getByText("نشط")).toBeInTheDocument();
    expect(within(rows[0]!).getByText(/أُنشئ في/)).toBeInTheDocument();
  });

  it("distinguishes a deactivated account", () => {
    ready([owner, employee, deactivated], []);
    render(<OrganizationUsersSection organizationId="org-1" />);

    const row = usersList().getByText("gone@tenant.example").closest("li")!;
    expect(within(row).getByText("غير نشط")).toBeInTheDocument();
    expect(within(row).getByText(/عُطّل في/)).toBeInTheDocument();
    expect(within(row).queryByText("نشط")).not.toBeInTheDocument();
  });

  it("renders pending and expired invitations separately from users", () => {
    ready([owner], [pending, expired]);
    render(<OrganizationUsersSection organizationId="org-1" />);

    const pendingRow = invitationsList().getByText("pending@tenant.example").closest("li")!;
    expect(within(pendingRow).getByText("قيد الانتظار")).toBeInTheDocument();
    expect(within(pendingRow).getByText(/تنتهي في/)).toBeInTheDocument();
    const expiredRow = invitationsList().getByText("expired@tenant.example").closest("li")!;
    expect(within(expiredRow).getByText("منتهية")).toBeInTheDocument();
    expect(within(expiredRow).getByText(/انتهت في/)).toBeInTheDocument();
    expect(usersList().queryByText("pending@tenant.example")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "تعطيل الموظف" })).not.toBeInTheDocument();
  });

  it("shows separate empty states for employees and invitations", () => {
    ready([owner], []);
    render(<OrganizationUsersSection organizationId="org-1" />);

    expect(screen.getByText("لا يوجد موظفون في هذه المؤسسة.")).toBeInTheDocument();
    expect(screen.getByText("لا توجد دعوات حالية.")).toBeInTheDocument();
    expect(screen.getByText("owner@tenant.example")).toBeInTheDocument();
  });

  it("only shows the employee empty state when there are no employees", () => {
    ready([owner, employee], [pending]);
    render(<OrganizationUsersSection organizationId="org-1" />);

    expect(screen.queryByText("لا يوجد موظفون في هذه المؤسسة.")).not.toBeInTheDocument();
    expect(screen.queryByText("لا توجد دعوات حالية.")).not.toBeInTheDocument();
  });

  it("renders long emails as wrapping left-to-right text", () => {
    ready([owner, employee], []);
    render(<OrganizationUsersSection organizationId="org-1" />);

    const email = screen.getByText(LONG_EMAIL);
    expect(email).toHaveClass("identifier-ltr", "break-all");
  });

  it("shows a local loading state", () => {
    useListPlatformOrganizationUsers.mockReturnValue({ isPending: true, isError: false });
    render(<OrganizationUsersSection organizationId="org-1" />);

    expect(screen.getByText("مستخدمو المؤسسة")).toBeInTheDocument();
    expect(screen.getByLabelText("جارٍ تحميل البيانات")).toHaveAttribute("aria-busy", "true");
  });

  it("shows a local accessible error with retry", () => {
    useListPlatformOrganizationUsers.mockReturnValue({
      isPending: false,
      isError: true,
      error: new Error("boom"),
      refetch,
    });
    render(<OrganizationUsersSection organizationId="org-1" />);

    expect(screen.getByRole("alert")).toHaveTextContent("تعذر تحميل مستخدمي المؤسسة");
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(refetch).toHaveBeenCalled();
  });
  describe("support actions", () => {
    const accepted = {
      id: "i-3",
      email: "accepted@tenant.example",
      status: "ACCEPTED",
      createdAt: "2026-03-01T00:00:00.000Z",
      expiresAt: "2026-03-08T00:00:00.000Z",
      acceptedAt: "2026-03-02T00:00:00.000Z",
    };

    function renderSection(status = "ACTIVE") {
      render(
        <OrganizationUsersSection
          organizationId="org-1"
          organizationStatus={status as "ACTIVE"}
        />,
      );
    }

    function rowOf(email: string) {
      return within(screen.getByText(email).closest("li")!);
    }

    it("shows recovery only on the owner and deactivation only on active employees", () => {
      ready([owner, employee, deactivated], []);
      renderSection();

      expect(rowOf("owner@tenant.example").getByRole("button", { name: "إرسال رابط استعادة كلمة المرور" })).toBeInTheDocument();
      expect(rowOf("owner@tenant.example").queryByRole("button", { name: "تعطيل الموظف" })).not.toBeInTheDocument();
      expect(rowOf(LONG_EMAIL).getByRole("button", { name: "تعطيل الموظف" })).toBeInTheDocument();
      expect(rowOf(LONG_EMAIL).queryByRole("button", { name: "إرسال رابط استعادة كلمة المرور" })).not.toBeInTheDocument();
      expect(within(screen.getByText("gone@tenant.example").closest("li")!).queryByRole("button")).not.toBeInTheDocument();
    });

    it("offers resend on pending and expired invitations but not accepted ones", () => {
      ready([owner], [pending, expired, accepted]);
      renderSection();

      expect(rowOf("pending@tenant.example").getByRole("button", { name: "إعادة إرسال الدعوة" })).toBeEnabled();
      expect(rowOf("expired@tenant.example").getByRole("button", { name: "إعادة إرسال الدعوة" })).toBeEnabled();
      expect(rowOf("accepted@tenant.example").queryByRole("button")).not.toBeInTheDocument();
    });

    it.each(["SUSPENDED", "CANCELLED"])("disables resend with an explanation while %s", (status) => {
      ready([owner], [pending]);
      renderSection(status);

      expect(rowOf("pending@tenant.example").getByRole("button", { name: "إعادة إرسال الدعوة" })).toBeDisabled();
      expect(screen.getByText(/لا يمكن إعادة إرسال الدعوات/)).toBeInTheDocument();
    });

    it("keeps owner recovery available for a suspended organization", () => {
      ready([owner], []);
      renderSection("SUSPENDED");

      expect(screen.getByRole("button", { name: "إرسال رابط استعادة كلمة المرور" })).toBeEnabled();
    });

    it("shows the reissued link once, with copy and dismiss, and clears it afterwards", async () => {
      const mutate = vi.fn((_vars, options) =>
        options.onSuccess({
          data: {
            email: "pending@tenant.example",
            expiresAt: "2026-06-01T00:00:00.000Z",
            acceptanceToken: "fresh-token-value-1234567890abcdefghijklmn",
          },
        }),
      );
      const reset = vi.fn();
      useResendPlatformEmployeeInvitation.mockReturnValue(idleMutation({ mutate, reset }));
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
      const setItem = vi.spyOn(Storage.prototype, "setItem");
      ready([owner], [pending]);
      renderSection();

      expect(document.body.innerHTML).not.toContain("fresh-token");
      fireEvent.click(screen.getByRole("button", { name: "إعادة إرسال الدعوة" }));

      expect(mutate).toHaveBeenCalledWith(
        { organizationId: "org-1", invitationId: "i-1" },
        expect.any(Object),
      );
      const link = (screen.getByLabelText("رابط الدعوة") as HTMLInputElement).value;
      expect(new URL(link).searchParams.get("token")).toBe("fresh-token-value-1234567890abcdefghijklmn");
      expect(screen.getByText("الرابط السابق لم يعد صالحاً.")).toBeInTheDocument();
      expect(screen.getByText(/وسيلة تواصل آمنة/)).toBeInTheDocument();
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["users", "org-1"] });
      expect(reset).toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "نسخ الرابط" }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(link));
      fireEvent.click(screen.getByRole("button", { name: "تم، إخفاء الرابط" }));

      expect(screen.queryByLabelText("رابط الدعوة")).not.toBeInTheDocument();
      expect(document.body.innerHTML).not.toContain("fresh-token");
      expect(setItem).not.toHaveBeenCalled();
      setItem.mockRestore();
    });

    it("shows a resend failure locally without breaking the list", () => {
      useResendPlatformEmployeeInvitation.mockReturnValue(
        idleMutation({ isError: true, error: new Error("nope") }),
      );
      ready([owner, employee], [pending]);
      renderSection();

      expect(screen.getByRole("alert")).toHaveTextContent("تعذر تنفيذ الطلب");
      expect(screen.getByText("owner@tenant.example")).toBeInTheDocument();
    });

    it("confirms owner recovery in a dialog and reports success without any token", () => {
      const mutate = vi.fn((_vars, options) => options.onSuccess());
      useRequestPlatformOwnerPasswordReset.mockReturnValue(idleMutation({ mutate }));
      ready([owner], []);
      renderSection();

      fireEvent.click(screen.getByRole("button", { name: "إرسال رابط استعادة كلمة المرور" }));
      const dialog = screen.getByRole("alertdialog");
      expect(within(dialog).getByText(/owner@tenant.example/)).toBeInTheDocument();
      expect(within(dialog).getByText(/لا يرى مشرف المنصة كلمة المرور/)).toBeInTheDocument();
      expect(within(dialog).getByText(/تنتهي جلسات المالك الحالية/)).toBeInTheDocument();
      expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
      expect(mutate).not.toHaveBeenCalled();

      fireEvent.click(within(dialog).getByRole("button", { name: "طلب إرسال الرابط" }));

      expect(mutate).toHaveBeenCalledWith({ organizationId: "org-1" }, expect.any(Object));
      expect(screen.getByText("تم طلب إرسال رابط استعادة كلمة المرور.")).toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("shows a recovery failure inside its dialog and keeps it open", () => {
      useRequestPlatformOwnerPasswordReset.mockReturnValue(
        idleMutation({ isError: true, error: new Error("fail") }),
      );
      ready([owner], []);
      renderSection();

      fireEvent.click(screen.getByRole("button", { name: "إرسال رابط استعادة كلمة المرور" }));

      const dialog = screen.getByRole("alertdialog");
      expect(within(dialog).getByRole("alert")).toHaveTextContent("تعذر تنفيذ الطلب");
      expect(within(dialog).getByRole("button", { name: "طلب إرسال الرابط" })).toBeEnabled();
    });

    it("requires a reason before deactivating an employee, then refetches", () => {
      const mutate = vi.fn((_vars, options) => options.onSuccess());
      useDeactivatePlatformEmployee.mockReturnValue(idleMutation({ mutate }));
      ready([owner, employee], []);
      renderSection();

      fireEvent.click(screen.getByRole("button", { name: "تعطيل الموظف" }));
      const dialog = screen.getByRole("alertdialog");
      const confirm = within(dialog).getByRole("button", { name: "تعطيل الموظف" });
      expect(within(dialog).getByText(/ولن يتمكن من تسجيل الدخول/)).toBeInTheDocument();
      expect(confirm).toBeDisabled();
      expect(confirm).toHaveClass("bg-destructive");
      fireEvent.change(within(dialog).getByLabelText(/سبب التعطيل/), { target: { value: "   " } });
      expect(confirm).toBeDisabled();
      fireEvent.change(within(dialog).getByLabelText(/سبب التعطيل/), { target: { value: "  غادر الشركة  " } });
      fireEvent.click(confirm);

      expect(mutate).toHaveBeenCalledWith(
        { organizationId: "org-1", userId: "u-emp", data: { reason: "غادر الشركة" } },
        expect.any(Object),
      );
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["users", "org-1"] });
      expect(screen.getByText("تم تعطيل حساب الموظف.")).toBeInTheDocument();
    });

    it("shows a deactivation failure inside the dialog and disables actions while pending", () => {
      useDeactivatePlatformEmployee.mockReturnValue(
        idleMutation({ isError: true, error: new Error("fail"), isPending: true }),
      );
      ready([owner, employee], []);
      renderSection();

      fireEvent.click(screen.getByRole("button", { name: "تعطيل الموظف" }));

      const dialog = screen.getByRole("alertdialog");
      expect(within(dialog).getByRole("alert")).toHaveTextContent("تعذر تنفيذ الطلب");
      expect(within(dialog).getByRole("button", { name: "رجوع" })).toBeDisabled();
      expect(within(dialog).getByRole("button", { name: "جارٍ التنفيذ" })).toBeDisabled();
    });

    it("resets mutation state when a dialog is dismissed", () => {
      const reset = vi.fn();
      useDeactivatePlatformEmployee.mockReturnValue(idleMutation({ reset }));
      ready([owner, employee], []);
      renderSection();

      fireEvent.click(screen.getByRole("button", { name: "تعطيل الموظف" }));
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "رجوع" }));

      expect(reset).toHaveBeenCalled();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });
});
