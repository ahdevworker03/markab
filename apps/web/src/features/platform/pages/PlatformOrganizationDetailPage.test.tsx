import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlatformOrganizationDetailPage from "./PlatformOrganizationDetailPage";

const {
  invalidateQueries,
  mutate,
  useGetPlatformOrganization,
  useUpdateOrganizationStatus,
} = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  mutate: vi.fn(),
  useGetPlatformOrganization: vi.fn(),
  useUpdateOrganizationStatus: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/platform/organizations/org-1", vi.fn()],
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));
vi.mock("@workspace/api-client-react", () => ({
  getGetPlatformOrganizationQueryKey: vi.fn((id) => ["organization", id]),
  getListPlatformOrganizationsQueryKey: vi.fn(() => ["organizations"]),
  useGetPlatformOrganization,
  useUpdateOrganizationStatus,
}));

describe("PlatformOrganizationDetailPage", () => {
  it("requires confirmation before mutating organization status", () => {
    useGetPlatformOrganization.mockReturnValue({
      data: {
        data: {
          id: "org-1",
          name: "مؤسسة الاختبار",
          status: "ACTIVE",
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
    useUpdateOrganizationStatus.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
    });

    render(
      <PlatformOrganizationDetailPage params={{ organizationId: "org-1" }} />,
    );

    fireEvent.change(screen.getByLabelText("الحالة الجديدة"), {
      target: { value: "SUSPENDED" },
    });
    fireEvent.click(screen.getByRole("button", { name: "تغيير الحالة" }));
    expect(mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "تأكيد التغيير" }));
    expect(mutate).toHaveBeenCalledWith({
      organizationId: "org-1",
      data: { status: "SUSPENDED" },
    });
  });
});
