import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setTokens } from "@/lib/auth-token";
import { AuthProvider, useAuth } from "./AuthProvider";

const api = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
  setAuthRefreshHandler: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => api);

const tenantA = {
  id: "user-a",
  email: "owner-a@example.com",
  role: "OWNER" as const,
  organizationId: "tenant-a",
  organizationStatus: "ACTIVE" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const tenantB = {
  ...tenantA,
  id: "user-b",
  email: "owner-b@example.com",
  organizationId: "tenant-b",
};

function AuthControls() {
  const { isAuthenticated, isLoading, login, logout, user } = useAuth();

  return (
    <>
      <p>
        {isLoading
          ? "loading"
          : isAuthenticated
            ? user?.organizationId
            : "signed-out"}
      </p>
      <button
        type="button"
        onClick={() =>
          void login({ email: "owner@example.com", password: "Password123!" })
        }
      >
        Login
      </button>
      <button type="button" onClick={() => void logout()}>
        Logout
      </button>
    </>
  );
}

function renderAuth(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthControls />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    api.logout.mockResolvedValue(undefined);
    api.login.mockResolvedValue({
      data: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresAt: "2026-01-01T01:00:00.000Z",
      },
    });
  });

  it("clears tenant cache when logging out", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["/api/vehicles"], [{ id: "vehicle-a" }]);
    renderAuth(queryClient);

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(queryClient.getQueryData(["/api/vehicles"])).toBeUndefined();
      expect(screen.getByText("signed-out")).toBeInTheDocument();
    });
  });

  it("does not expose tenant A cache after signing in as tenant B", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["/api/vehicles"], [{ id: "vehicle-a" }]);
    api.getCurrentUser.mockResolvedValueOnce({ data: tenantB });
    renderAuth(queryClient);

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByText("tenant-b")).toBeInTheDocument();
      expect(queryClient.getQueryData(["/api/vehicles"])).toBeUndefined();
    });
  });

  it("clears tenant cache and fails closed when session restoration cannot refresh", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["/api/vehicles"], [{ id: "vehicle-a" }]);
    setTokens("expired-access-token", "expired-refresh-token");
    api.getCurrentUser.mockRejectedValueOnce(new Error("unauthorized"));
    api.refreshToken.mockRejectedValueOnce(new Error("refresh rejected"));

    renderAuth(queryClient);

    await waitFor(() => {
      expect(screen.getByText("signed-out")).toBeInTheDocument();
      expect(queryClient.getQueryData(["/api/vehicles"])).toBeUndefined();
    });
  });

  it("clears tenant cache when session restoration has no refresh token", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["/api/vehicles"], [{ id: "vehicle-a" }]);
    setTokens("expired-access-token", "");
    api.getCurrentUser.mockRejectedValueOnce(new Error("unauthorized"));

    renderAuth(queryClient);

    await waitFor(() => {
      expect(screen.getByText("signed-out")).toBeInTheDocument();
      expect(queryClient.getQueryData(["/api/vehicles"])).toBeUndefined();
    });
  });

  it("clears tenant cache when /auth/me returns no current user", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["/api/vehicles"], [{ id: "vehicle-a" }]);
    setTokens("access-token", "refresh-token");
    api.getCurrentUser.mockResolvedValueOnce({ data: null });

    renderAuth(queryClient);

    await waitFor(() => {
      expect(screen.getByText("signed-out")).toBeInTheDocument();
      expect(queryClient.getQueryData(["/api/vehicles"])).toBeUndefined();
    });
  });
});
