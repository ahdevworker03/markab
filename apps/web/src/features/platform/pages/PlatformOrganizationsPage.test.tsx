import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlatformOrganizationsPage from "./PlatformOrganizationsPage";

const { setLocation, useListPlatformOrganizations } = vi.hoisted(() => ({
  setLocation: vi.fn(),
  useListPlatformOrganizations: vi.fn(),
}));

vi.mock("wouter", () => ({ useLocation: () => ["/platform", setLocation] }));
vi.mock("@workspace/api-client-react", () => ({
  useListPlatformOrganizations,
}));

describe("PlatformOrganizationsPage", () => {
  it("renders generated platform organization results and opens their detail", () => {
    useListPlatformOrganizations.mockReturnValue({
      data: {
        data: [
          {
            id: "org-1",
            name: "مؤسسة الاختبار",
            email: "owner@example.com",
            status: "ACTIVE",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
      isPending: false,
      isError: false,
    });

    render(<PlatformOrganizationsPage />);

    expect(screen.getByText("مؤسسة الاختبار")).toBeInTheDocument();
    screen.getByRole("button", { name: "عرض" }).click();
    expect(setLocation).toHaveBeenCalledWith("/platform/organizations/org-1");
    expect(useListPlatformOrganizations).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
  });
});
