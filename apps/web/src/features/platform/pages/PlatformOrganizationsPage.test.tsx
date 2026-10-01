import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlatformOrganizationsPage from "./PlatformOrganizationsPage";

const { useListPlatformOrganizations, refetch } = vi.hoisted(() => ({
  useListPlatformOrganizations: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("wouter", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
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
    expect(
      within(links[0]!).getByText("مؤسسة الاختبار للتأجير"),
    ).toBeInTheDocument();
    expect(within(links[0]!).getByText("org-…rg-1")).toBeInTheDocument();
    expect(links[0]).not.toHaveTextContent("owner@example.com");
    expect(within(links[0]!).getByText("نشط")).toBeInTheDocument();
    expect(within(links[0]!).getByText("01/01/2026")).toBeInTheDocument();
    expect(within(links[1]!).getByText("معلّق")).toBeInTheDocument();
    expect(screen.getByText("3 مؤسسة")).toBeInTheDocument();
  });

  it("offers an Add Organization primary action that opens the create page", () => {
    ready();
    render(<PlatformOrganizationsPage />);

    const action = screen.getByRole("link", { name: "إضافة مؤسسة" });
    expect(action).toHaveAttribute("href", "/platform/organizations/new");
  });

  it("keeps the Add Organization action available when there are no organizations", () => {
    ready([]);
    render(<PlatformOrganizationsPage />);

    expect(
      screen.getByRole("link", { name: "إضافة مؤسسة" }),
    ).toBeInTheDocument();
  });

  it("shows a short LTR identifier under each name, with the full id as its title", () => {
    const id = "7f2a1c3e-8b4d-4e6f-9a0b-5c7d2e1f91c4";
    ready([{ ...organizations[0]!, id }]);
    render(<PlatformOrganizationsPage />);

    const identifier = screen.getByText("7f2a…91c4");
    expect(identifier).toHaveClass("identifier-ltr");
    expect(identifier).toHaveAttribute("title", id);
    expect(screen.queryByText(id)).not.toBeInTheDocument();
    expect(identifier.closest("a")).toHaveAttribute(
      "href",
      `/platform/organizations/${id}`,
    );
  });

  it("keeps same-named organizations distinguishable and linked to their own detail pages", () => {
    const first = "11111111-aaaa-4aaa-8aaa-aaaaaaaa0001";
    const second = "22222222-bbbb-4bbb-8bbb-bbbbbbbb0002";
    ready([
      { ...organizations[0]!, id: first, name: "Markab Staging Tenant 1" },
      { ...organizations[0]!, id: second, name: "Markab Staging Tenant 1" },
    ]);
    render(<PlatformOrganizationsPage />);

    const rows = within(screen.getByRole("list")).getAllByRole("link");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText("1111…0001")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("2222…0002")).toBeInTheDocument();
    expect(rows[0]).toHaveAttribute("href", `/platform/organizations/${first}`);
    expect(rows[1]).toHaveAttribute(
      "href",
      `/platform/organizations/${second}`,
    );
  });

  it("shows only the short identifier on the secondary line, never the organization email", () => {
    ready([
      { ...organizations[1]!, id: "33333333-cccc-4ccc-8ccc-cccccccc0003" },
    ]);
    render(<PlatformOrganizationsPage />);

    const row = screen.getByText("Long Email Rentals").closest("a")!;
    expect(within(row).getByText("3333…0003")).toBeInTheDocument();
    expect(screen.queryByText(LONG_EMAIL)).not.toBeInTheDocument();
    expect(row).not.toHaveTextContent("@");
  });

  it("keeps the count secondary to the list title and the Add Organization action in the header", () => {
    ready();
    render(<PlatformOrganizationsPage />);

    const header = screen
      .getByRole("heading", { name: "المؤسسات", level: 1 })
      .closest("header")!;
    expect(
      within(header).getByRole("link", { name: "إضافة مؤسسة" }),
    ).toHaveAttribute("href", "/platform/organizations/new");
    expect(
      screen.getByRole("heading", { name: "قائمة المؤسسات" }),
    ).toBeInTheDocument();
    expect(screen.getByText("3 مؤسسة")).toHaveClass(
      "text-xs",
      "text-muted-foreground",
    );
  });

  it("never renders a placeholder dash or any email in the rows", () => {
    ready();
    render(<PlatformOrganizationsPage />);

    const list = within(screen.getByRole("list"));
    expect(list.queryByText("-")).not.toBeInTheDocument();
    expect(screen.getByRole("list")).not.toHaveTextContent("@");
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
    expect(
      screen.getByRole("combobox", { name: "تصفية حسب الحالة" }),
    ).toBeInTheDocument();
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
    useListPlatformOrganizations.mockReturnValue({
      isPending: true,
      isError: false,
    });
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
    expect(useListPlatformOrganizations).toHaveBeenLastCalledWith({
      page: 2,
      pageSize: 20,
    });
  });
});
