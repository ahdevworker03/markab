import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlatformOrganizationDetailPage from "./PlatformOrganizationDetailPage";

const {
  invalidateQueries,
  mutate,
  reset,
  useGetPlatformOrganization,
  useListPlatformOrganizationUsers,
  useUpdateOrganizationStatus,
} = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  mutate: vi.fn(),
  reset: vi.fn(),
  useGetPlatformOrganization: vi.fn(),
  useListPlatformOrganizationUsers: vi.fn(),
  useUpdateOrganizationStatus: vi.fn(),
}));

const idleMutation = { mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false };

vi.mock("wouter", () => ({
  useLocation: () => ["/platform/organizations/org-1", vi.fn()],
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));
vi.mock("@/lib/api-error", () => ({
  getApiErrorMessage: () => ({ title: "ليس لديك صلاحية لتنفيذ هذا الإجراء." }),
}));
vi.mock("@workspace/api-client-react", () => ({
  getGetPlatformOrganizationQueryKey: vi.fn((id) => ["organization", id]),
  getListPlatformOrganizationsQueryKey: vi.fn(() => ["organizations"]),
  useGetPlatformOrganization,
  getListPlatformOrganizationUsersQueryKey: vi.fn((id) => ["users", id]),
  useListPlatformOrganizationUsers,
  useResendPlatformEmployeeInvitation: () => idleMutation,
  useRequestPlatformOwnerPasswordReset: () => idleMutation,
  useDeactivatePlatformEmployee: () => idleMutation,
  useUpdateOrganizationStatus,
}));

function mockOrganization(status: string) {
  useGetPlatformOrganization.mockReturnValue({
    data: {
      data: {
        id: "org-1",
        name: "مؤسسة الاختبار",
        status,
        legalName: null,
        phone: null,
        email: null,
        address: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    },
    isPending: false,
    isError: false,
  });
}

function mockMutation(overrides: Record<string, unknown> = {}) {
  useUpdateOrganizationStatus.mockReturnValue({
    mutate,
    reset,
    isPending: false,
    isError: false,
    ...overrides,
  });
}

function renderPage() {
  render(
    <PlatformOrganizationDetailPage params={{ organizationId: "org-1" }} />,
  );
}

const LABELS: Record<string, string> = {
  TRIAL: "تجريبي",
  ACTIVE: "نشط",
  SUSPENDED: "معلّق",
  CANCELLED: "ملغي",
};

function optionValues(): string[] {
  return screen
    .queryAllByRole("radio")
    .map((radio) => radio.getAttribute("value") ?? "");
}

function selectStatus(value: string) {
  fireEvent.click(screen.getByRole("radio", { name: LABELS[value] }));
}

describe("PlatformOrganizationDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutation();
    useListPlatformOrganizationUsers.mockReturnValue({
      data: { data: { users: [], invitations: [] } },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it.each([
    ["TRIAL", ["ACTIVE", "SUSPENDED", "CANCELLED"]],
    ["ACTIVE", ["SUSPENDED", "CANCELLED"]],
    ["SUSPENDED", ["ACTIVE", "CANCELLED"]],
    ["CANCELLED", ["ACTIVE"]],
  ])("offers only the valid next statuses from %s and shows the current one", (status, expected) => {
    mockOrganization(status);
    renderPage();

    expect(optionValues()).toEqual(expected);
    expect(screen.getByText("الحالة الحالية")).toBeInTheDocument();
  });

  it("keeps the identity block together and shows missing fields as unspecified", () => {
    mockOrganization("ACTIVE");
    renderPage();

    const heading = screen.getByRole("heading", { name: "مؤسسة الاختبار" });
    expect(heading.parentElement).toHaveTextContent("نشط");
    expect(screen.getAllByText("غير محدد").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText("-")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /المؤسسات/ })).toHaveAttribute("href", "/platform");
  });

  it("offers a way back to the list when the organization is not found", () => {
    useGetPlatformOrganization.mockReturnValue({
      isPending: false,
      isError: true,
      error: { status: 404 },
    });
    renderPage();

    expect(screen.getByText("المؤسسة غير موجودة")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "العودة إلى المؤسسات" })).toHaveAttribute("href", "/platform");
    expect(screen.queryByRole("button", { name: "إعادة المحاولة" })).not.toBeInTheDocument();
  });

  it("disables submission until a different status is chosen", () => {
    mockOrganization("ACTIVE");
    renderPage();

    const submit = screen.getByRole("button", { name: "تغيير الحالة" });
    expect(submit).toBeDisabled();
    selectStatus("SUSPENDED");
    expect(screen.getByLabelText(/سبب التغيير/)).toBeInTheDocument();
    expect(submit).toBeDisabled();
  });

  it("requires a reason for suspension and sends it trimmed after confirmation", () => {
    mockOrganization("ACTIVE");
    renderPage();

    selectStatus("SUSPENDED");
    const submit = screen.getByRole("button", { name: "تغيير الحالة" });
    fireEvent.change(screen.getByLabelText(/سبب التغيير/), {
      target: { value: "   " },
    });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/سبب التغيير/), {
      target: { value: "  فواتير غير مسددة  " },
    });
    expect(submit).toBeEnabled();

    fireEvent.click(submit);
    expect(mutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("فواتير غير مسددة")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "تعليق المؤسسة" }));

    expect(mutate).toHaveBeenCalledWith({
      organizationId: "org-1",
      data: { status: "SUSPENDED", reason: "فواتير غير مسددة" },
    });
  });

  it("does not ask for a reason on a plain activation and omits it from the request", () => {
    mockOrganization("TRIAL");
    renderPage();

    selectStatus("ACTIVE");
    expect(screen.queryByLabelText(/سبب التغيير/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تغيير الحالة" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "تأكيد التفعيل",
      }),
    );

    expect(mutate).toHaveBeenCalledWith({
      organizationId: "org-1",
      data: { status: "ACTIVE" },
    });
  });

  it("styles suspension as destructive and activation as a normal action", () => {
    mockOrganization("ACTIVE");
    renderPage();
    selectStatus("SUSPENDED");
    fireEvent.change(screen.getByLabelText(/سبب التغيير/), {
      target: { value: "سبب" },
    });
    fireEvent.click(screen.getByRole("button", { name: "تغيير الحالة" }));
    expect(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "تعليق المؤسسة",
      }),
    ).toHaveClass("bg-destructive");
  });

  it("does not style activation as destructive", () => {
    mockOrganization("SUSPENDED");
    renderPage();
    selectStatus("ACTIVE");
    fireEvent.click(screen.getByRole("button", { name: "تغيير الحالة" }));
    const confirm = within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "تأكيد التفعيل",
    });
    expect(confirm).not.toHaveClass("bg-destructive");
  });

  it("requires a reason to reactivate a cancelled organization", () => {
    mockOrganization("CANCELLED");
    renderPage();

    selectStatus("ACTIVE");

    expect(screen.getByLabelText(/سبب التغيير/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تغيير الحالة" })).toBeDisabled();
  });

  it("shows a failed mutation inside the open confirmation dialog", () => {
    mockOrganization("ACTIVE");
    mockMutation({ isError: true, error: new Error("forbidden") });
    renderPage();

    selectStatus("CANCELLED");
    fireEvent.change(screen.getByLabelText(/سبب التغيير/), {
      target: { value: "إنهاء العقد" },
    });
    fireEvent.click(screen.getByRole("button", { name: "تغيير الحالة" }));

    const dialog = screen.getByRole("alertdialog");
    expect(
      within(dialog).getByRole("alert"),
    ).toHaveTextContent("ليس لديك صلاحية لتنفيذ هذا الإجراء.");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(
      within(dialog).getByRole("button", { name: "إلغاء المؤسسة" }),
    ).toBeEnabled();
  });

  it("clears the mutation error when the dialog is cancelled", () => {
    mockOrganization("ACTIVE");
    renderPage();

    selectStatus("SUSPENDED");
    fireEvent.change(screen.getByLabelText(/سبب التغيير/), {
      target: { value: "سبب" },
    });
    fireEvent.click(screen.getByRole("button", { name: "تغيير الحالة" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "رجوع" }),
    );

    expect(reset).toHaveBeenCalled();
  });

  it("keeps the organization and lifecycle controls usable when the users query fails", () => {
    mockOrganization("ACTIVE");
    useListPlatformOrganizationUsers.mockReturnValue({
      isPending: false,
      isError: true,
      error: new Error("users failed"),
      refetch: vi.fn(),
    });
    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("تعذر تحميل مستخدمي المؤسسة");
    expect(screen.getByRole("heading", { name: "مؤسسة الاختبار" })).toBeInTheDocument();
    selectStatus("SUSPENDED");
    fireEvent.change(screen.getByLabelText(/سبب التغيير/), {
      target: { value: "سبب" },
    });
    expect(screen.getByRole("button", { name: "تغيير الحالة" })).toBeEnabled();
  });

  it("keeps the organization usable while the users are loading", () => {
    mockOrganization("ACTIVE");
    useListPlatformOrganizationUsers.mockReturnValue({ isPending: true, isError: false });
    renderPage();

    expect(screen.getByLabelText("جارٍ تحميل البيانات")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "معلّق" })).toBeEnabled();
  });

  it("invalidates detail and list queries after a successful update", () => {
    mockOrganization("ACTIVE");
    renderPage();

    const options = useUpdateOrganizationStatus.mock.calls[0]?.[0] as {
      mutation: { onSuccess: () => void };
    };
    options.mutation.onSuccess();

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["organization", "org-1"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["organizations"],
    });
  });
});
