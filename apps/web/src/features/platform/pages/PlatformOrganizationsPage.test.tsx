import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlatformOrganizationsPage from "./PlatformOrganizationsPage";

const { useListPlatformOrganizations, refetch } = vi.hoisted(() => ({
  useListPlatformOrganizations: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/api-error", () => ({
  getApiErrorMessage: () => ({ title: "تعذر تنفيذ الطلب" }),
}));
vi.mock("@workspace/api-client-react", () => ({
  useListPlatformOrganizations,
}));

const LONG_EMAIL =
  "an.extremely.long.organization.contact.address@very-long-subdomain.example-company-name.example.com";

const organizations = [
  {
    id: "org-1",
    name: "مؤسسة الاختبار للتأجير",
    email: "owner@example.com",
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "org-2",
    name: "Long Email Rentals",
    email: LONG_EMAIL,
    status: "SUSPENDED",
    createdAt: "2026-02-03T00:00:00.000Z",
  },
  {
    id: "org-3",
    name: "No Email Cars",
    email: null,
    status: "TRIAL",
    createdAt: "2026-03-04T00:00:00.000Z",
  },
];

function ready(data = organizations, totalPages = 1) {
  useListPlatformOrganizations.mockReturnValue({
    data: {
      data,
      pagination: { page: 1, pageSize: 20, total: data.length, totalPages },
    },
    isPending: false,
    isError: false,
    refetch,
  });
}

describe("PlatformOrganizationsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists organizations as links to their detail pages with name as primary identity", () => {
    ready();
    render(<PlatformOrganizationsPage />);

    const links = within(screen.getByRole("list")).getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", "/platform/organizations/org-1");
    expect(within(links[0]!).getByText("مؤسسة الاختبار للتأجير")).toBeInTheDocument();
    expect(within(links[0]!).getByText("owner@example.com")).toBeInTheDocument();
    expect(within(links[0]!).getByText("نشط")).toBeInTheDocument();
    expect(within(links[0]!).getByText("01/01/2026")).toBeInTheDocument();
    expect(within(links[1]!).getByText("معلّق")).toBeInTheDocument();
    expect(screen.getByText("3 مؤسسة")).toBeInTheDocument();
  });

  it("omits the email line when there is none and never renders a placeholder dash", () => {
    ready();
    render(<PlatformOrganizationsPage />);

    const row = screen.getByText("No Email Cars").closest("a")!;
    expect(within(row).queryByText("-")).not.toBeInTheDocument();
    expect(row).not.toHaveTextContent("@");
  });

  it("keeps long emails wrapping and left-to-right", () => {
    ready();
    render(<PlatformOrganizationsPage />);

    expect(screen.getByText(LONG_EMAIL)).toHaveClass("identifier-ltr", "break-all");
  });

  it("renders no table (mobile-native list at every width)", () => {
    ready();
    render(<PlatformOrganizationsPage />);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("offers accessible search and status filter controls", () => {
    ready();
    render(<PlatformOrganizationsPage />);

    expect(screen.getByLabelText("البحث في المؤسسات")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "تصفية حسب الحالة" })).toBeInTheDocument();
  });

  it("requests filtered results when searching and resets to page one", () => {
    vi.useFakeTimers();
    ready();
    render(<PlatformOrganizationsPage />);

    fireEvent.change(screen.getByLabelText("البحث في المؤسسات"), {
      target: { value: "gamma" },
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(useListPlatformOrganizations).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 20,
      search: "gamma",
    });
    vi.useRealTimers();
  });

  it("shows a loading state", () => {
    useListPlatformOrganizations.mockReturnValue({ isPending: true, isError: false });
    render(<PlatformOrganizationsPage />);

    expect(screen.getByLabelText("جارٍ تحميل البيانات")).toBeInTheDocument();
  });

  it("shows an error with retry", () => {
    useListPlatformOrganizations.mockReturnValue({
      isPending: false,
      isError: true,
      error: new Error("x"),
      refetch,
    });
    render(<PlatformOrganizationsPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("تعذر تحميل المؤسسات");
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("distinguishes an empty platform from empty search results", () => {
    vi.useFakeTimers();
    ready([]);
    render(<PlatformOrganizationsPage />);
    expect(screen.getByText("لا توجد مؤسسات")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("البحث في المؤسسات"), {
      target: { value: "zzz" },
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText("لا توجد نتائج مطابقة")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("paginates when there is more than one page", () => {
    ready(organizations, 3);
    render(<PlatformOrganizationsPage />);

    expect(screen.getByRole("button", { name: "السابق" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    expect(useListPlatformOrganizations).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 });
  });
});
