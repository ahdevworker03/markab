import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlatformCreateOrganizationPage from "./PlatformCreateOrganizationPage";

const { mutateAsync, setLocation, toast, useCreatePlatformOrganization } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  setLocation: vi.fn(),
  toast: vi.fn(),
  useCreatePlatformOrganization: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/platform/organizations/new", setLocation],
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/use-toast", () => ({ toast }));
vi.mock("@/lib/api-error", () => ({
  getApiErrorMessage: () => ({ title: "تحقق من البيانات المدخلة ثم حاول مرة أخرى." }),
}));
vi.mock("@workspace/api-client-react", () => ({ useCreatePlatformOrganization }));

// Radix radio items inside a <form> observe their size; jsdom has no ResizeObserver.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const LONG_EMAIL =
  "an.extremely.long.owner.address.for.layout.testing@very-long-subdomain.example-company-name.example.com";

function mockMutation(overrides: Record<string, unknown> = {}) {
  useCreatePlatformOrganization.mockReturnValue({ mutateAsync, isPending: false, ...overrides });
}

function fill(name: string, email: string) {
  fireEvent.change(screen.getByLabelText(/اسم المؤسسة/), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/البريد الإلكتروني لمالك المؤسسة/), { target: { value: email } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /إنشاء المؤسسة|جارٍ الإنشاء/ }));
}

describe("PlatformCreateOrganizationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutation();
    mutateAsync.mockResolvedValue({
      data: {
        organization: { id: "org-new", name: "x", status: "ACTIVE" },
        owner: { id: "u1", email: "owner@example.com", role: "OWNER" },
      },
    });
  });

  it("renders the minimal form inside the page with ACTIVE selected by default", () => {
    render(<PlatformCreateOrganizationPage />);

    expect(screen.getByRole("heading", { name: "إضافة مؤسسة" })).toBeInTheDocument();
    expect(screen.getByLabelText(/اسم المؤسسة/)).toBeInTheDocument();
    expect(screen.getByLabelText(/البريد الإلكتروني لمالك المؤسسة/)).toHaveAttribute("type", "email");
    expect(screen.getByRole("radio", { name: /نشط/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /تجريبي/ })).not.toBeChecked();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("has no password, role, billing, plan, or trial-duration fields", () => {
    render(<PlatformCreateOrganizationPage />);

    expect(screen.queryByLabelText(/كلمة المرور/)).not.toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    for (const forbidden of [/الدور/, /الخطة/, /الاشتراك/, /الفوترة/, /مدة التجربة/, /الهاتف/, /العنوان/, /الاسم القانوني/]) {
      expect(screen.queryByLabelText(forbidden)).not.toBeInTheDocument();
    }
    expect(document.querySelectorAll("input:not([type=radio]), select, textarea")).toHaveLength(2);
  });

  it("requires an organization name and owner email", () => {
    render(<PlatformCreateOrganizationPage />);

    submit();

    expect(screen.getByText("اسم المؤسسة مطلوب.")).toBeInTheDocument();
    expect(screen.getByText("البريد الإلكتروني للمالك مطلوب.")).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it.each(["not-an-email", "missing@tld", "two@@example.com", "spaced out@example.com"])(
    "rejects the invalid email %s",
    (email) => {
      render(<PlatformCreateOrganizationPage />);
      fill("مؤسسة الاختبار", email);

      submit();

      expect(screen.getByText("أدخل بريداً إلكترونياً صحيحاً.")).toBeInTheDocument();
      expect(mutateAsync).not.toHaveBeenCalled();
    },
  );

  it("treats a whitespace-only name as missing", () => {
    render(<PlatformCreateOrganizationPage />);
    fill("   ", "owner@example.com");

    submit();

    expect(screen.getByText("اسم المؤسسة مطلوب.")).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("submits organizationName, ownerEmail and initialStatus ACTIVE by default", async () => {
    render(<PlatformCreateOrganizationPage />);
    fill("  شركة الأرز لتأجير السيارات  ", `  ${LONG_EMAIL}  `);

    submit();

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({
      data: {
        organizationName: "شركة الأرز لتأجير السيارات",
        ownerEmail: LONG_EMAIL,
        initialStatus: "ACTIVE",
      },
    });
  });

  it("lets the operator choose TRIAL and submits it", async () => {
    render(<PlatformCreateOrganizationPage />);
    fill("Cedar Rentals", "owner@example.com");

    fireEvent.click(screen.getByRole("radio", { name: /تجريبي/ }));
    expect(screen.getByRole("radio", { name: /تجريبي/ })).toBeChecked();
    submit();

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0]?.[0].data.initialStatus).toBe("TRIAL");
  });

  it("on success confirms creation without claiming delivery and opens the new organization", async () => {
    render(<PlatformCreateOrganizationPage />);
    fill("Cedar Rentals", "owner@example.com");

    submit();

    await waitFor(() => expect(setLocation).toHaveBeenCalledWith("/platform/organizations/org-new"));
    expect(toast).toHaveBeenCalledTimes(1);
    const message = toast.mock.calls[0]![0] as { title: string; description: string };
    expect(message.title).toBe("تم إنشاء المؤسسة وحساب المالك");
    expect(message.description).toContain("تم طلب إرسال رابط إعداد كلمة المرور");
    expect(message.description).not.toContain("@");
    expect(message.description).not.toMatch(/تم إرسال|وصل الرابط بنجاح/);
  });

  it("explains a duplicate owner email on the email field and keeps the entered values", async () => {
    mutateAsync.mockRejectedValue({ status: 409, data: { error: { code: "EMAIL_ALREADY_EXISTS" } } });
    render(<PlatformCreateOrganizationPage />);
    fill("Cedar Rentals", "taken@example.com");

    submit();

    expect(await screen.findByText(/مرتبط بحساب موجود بالفعل/)).toBeInTheDocument();
    expect(screen.getByLabelText(/اسم المؤسسة/)).toHaveValue("Cedar Rentals");
    expect(screen.getByLabelText(/البريد الإلكتروني لمالك المؤسسة/)).toHaveValue("taken@example.com");
    expect(screen.getByLabelText(/البريد الإلكتروني لمالك المؤسسة/)).toHaveAttribute("aria-invalid", "true");
    expect(setLocation).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it("shows other API errors as form feedback and allows retrying", async () => {
    mutateAsync.mockRejectedValueOnce({ status: 422, data: { error: { code: "VALIDATION_ERROR" } } });
    render(<PlatformCreateOrganizationPage />);
    fill("Cedar Rentals", "owner@example.com");

    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("تحقق من البيانات المدخلة");
    expect(setLocation).not.toHaveBeenCalled();
    submit();
    await waitFor(() => expect(setLocation).toHaveBeenCalledWith("/platform/organizations/org-new"));
  });

  it("disables the form and prevents duplicate submissions while submitting", () => {
    mockMutation({ isPending: true });
    render(<PlatformCreateOrganizationPage />);
    fill("Cedar Rentals", "owner@example.com");

    const button = screen.getByRole("button", { name: "جارٍ الإنشاء" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    fireEvent.submit(button.closest("form")!);

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/اسم المؤسسة/)).toBeDisabled();
  });

  it("cancels back to the organizations list without creating anything", () => {
    render(<PlatformCreateOrganizationPage />);
    fill("Cedar Rentals", "owner@example.com");

    expect(screen.getByRole("link", { name: "إلغاء" })).toHaveAttribute("href", "/platform");
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
