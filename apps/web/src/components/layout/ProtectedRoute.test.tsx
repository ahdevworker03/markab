import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "./ProtectedRoute";

const { setLocation, useAuth } = vi.hoisted(() => ({
  setLocation: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/", setLocation],
}));
vi.mock("@/providers/AuthProvider", () => ({ useAuth }));

const tenantUser = {
  id: "user-1",
  email: "owner@example.com",
  role: "OWNER",
  organizationId: "tenant-1",
  organizationStatus: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function TenantQueryProbe() {
  useQuery({ queryKey: ["/api/vehicles"], queryFn: async () => [] });
  return <p>tenant shell</p>;
}

function renderRoute(queryClient = new QueryClient()) {
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ProtectedRoute>
          <TenantQueryProbe />
        </ProtectedRoute>
      </QueryClientProvider>,
    ),
  };
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    setLocation.mockReset();
  });

  it.each(["OWNER", "EMPLOYEE"])("allows %s into the tenant shell", (role) => {
    useAuth.mockReturnValue({
      user: { ...tenantUser, role },
      isAuthenticated: true,
      isLoading: false,
    });

    renderRoute();

    expect(screen.getByText("tenant shell")).toBeInTheDocument();
    expect(setLocation).not.toHaveBeenCalled();
  });

  it("denies a platform owner before tenant queries mount", async () => {
    useAuth.mockReturnValue({
      user: { ...tenantUser, role: "PLATFORM_OWNER" },
      isAuthenticated: true,
      isLoading: false,
    });
    const { queryClient } = renderRoute();

    await waitFor(() =>
      expect(setLocation).toHaveBeenCalledWith("/login", { replace: true }),
    );

    expect(screen.queryByText("tenant shell")).not.toBeInTheDocument();
    expect(queryClient.getQueryData(["/api/vehicles"])).toBeUndefined();
  });

  it("denies an authenticated session without a current user", async () => {
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: true,
      isLoading: false,
    });

    renderRoute();

    await waitFor(() =>
      expect(setLocation).toHaveBeenCalledWith("/login", { replace: true }),
    );
    expect(screen.queryByText("tenant shell")).not.toBeInTheDocument();
  });
});
