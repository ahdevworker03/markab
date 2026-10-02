import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/lib/auth-token";
import {
  getOfflineIdentity,
  saveOfflineIdentity,
} from "@/features/offline/session";
import {
  OfflineProvider,
  useOffline,
} from "@/features/offline/OfflineProvider";
import type { OfflineStore } from "@/features/offline/types";
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
  const {
    isAuthenticated,
    isLoading,
    login,
    logout,
    retry,
    sessionState,
    user,
  } = useAuth();

  return (
    <>
      <p>
        {isLoading
          ? "loading"
          : isAuthenticated
            ? user?.organizationId
            : sessionState === "unauthenticated"
              ? "signed-out"
              : sessionState}
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
      <button type="button" onClick={() => void retry()}>
        Retry
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

function createDurableStore(): OfflineStore {
  return {
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getCustomers: vi.fn().mockResolvedValue([{ id: "customer-a" }]),
    getCustomer: vi.fn(),
    getVehicles: vi.fn(),
    getVehicle: vi.fn(),
    getRental: vi.fn(),
    getCompletionCursor: vi.fn(),
    requireReconciliation: vi.fn(),
    isReconciliationRequired: vi.fn().mockResolvedValue(false),
    subscribeOutbox: vi.fn(() => () => undefined),
    applyPull: vi.fn(),
    enqueue: vi.fn(),
    listOutbox: vi.fn().mockResolvedValue([{ operation_id: "queued-a" }]),
    getOutboxItem: vi.fn(),
    updateOutbox: vi.fn(),
    removeOutbox: vi.fn(),
    replaceCustomerConflict: vi.fn(),
    discardCustomerConflict: vi.fn(),
    discardActionRequired: vi.fn(),
    reconcileCustomerCreate: vi.fn(),
    clearWorkspace: vi.fn().mockResolvedValue(undefined),
  };
}

function OfflineStatus() {
  const { status } = useOffline();
  return <p>{status}</p>;
}

function renderAuthWithOffline(queryClient: QueryClient, store: OfflineStore) {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OfflineProvider store={store}>
          <AuthControls />
          <OfflineStatus />
        </OfflineProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearAccessToken();
    vi.clearAllMocks();
    api.refreshToken.mockRejectedValue({ status: 401 });
    api.logout.mockResolvedValue(undefined);
    api.login.mockResolvedValue({
      data: {
        accessToken: "access-token",
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

  it("clears the session after a 401 refresh failure", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["/api/vehicles"], [{ id: "vehicle-a" }]);
    setAccessToken("expired-access-token");
    api.getCurrentUser.mockRejectedValueOnce({ status: 401 });
    api.refreshToken.mockRejectedValueOnce({ status: 401 });

    renderAuth(queryClient);

    await waitFor(() => {
      expect(screen.getByText("signed-out")).toBeInTheDocument();
      expect(queryClient.getQueryData(["/api/vehicles"])).toBeUndefined();
    });
  });

  it("restores an in-memory session after reload through the refresh cookie", async () => {
    const queryClient = new QueryClient();
    api.refreshToken.mockResolvedValueOnce({
      data: { accessToken: "restored-access-token" },
    });
    api.getCurrentUser.mockResolvedValueOnce({ data: tenantA });

    renderAuth(queryClient);

    await waitFor(() => {
      expect(screen.getByText("tenant-a")).toBeInTheDocument();
      expect(getAccessToken()).toBe("restored-access-token");
    });
  });

  it("persists a tenant identity only after an authoritative current-user response", async () => {
    const queryClient = new QueryClient();
    api.refreshToken.mockResolvedValueOnce({
      data: { accessToken: "restored-access-token" },
    });
    api.getCurrentUser.mockResolvedValueOnce({ data: tenantA });

    renderAuth(queryClient);

    await waitFor(() => {
      expect(getOfflineIdentity()).toEqual({
        id: "user-a",
        organizationId: "tenant-a",
        role: "OWNER",
        organizationStatus: "ACTIVE",
      });
    });
  });

  it("keeps the validated offline identity after an unreachable refresh", async () => {
    const queryClient = new QueryClient();
    saveOfflineIdentity({
      id: "user-a",
      organizationId: "tenant-a",
      role: "OWNER",
      organizationStatus: "ACTIVE",
    });
    api.refreshToken.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    renderAuth(queryClient);

    await waitFor(() => {
      expect(getOfflineIdentity()).toEqual({
        id: "user-a",
        organizationId: "tenant-a",
        role: "OWNER",
        organizationStatus: "ACTIVE",
      });
      expect(screen.getByText("offline")).toBeInTheDocument();
    });
  });

  it.each([{ status: 403 }, { status: 503 }])(
    "does not restore an offline workspace after a reachable $status refresh failure",
    async (error) => {
      const queryClient = new QueryClient();
      saveOfflineIdentity({
        id: "user-a",
        organizationId: "tenant-a",
        role: "OWNER",
        organizationStatus: "ACTIVE",
      });
      api.refreshToken.mockRejectedValueOnce(error);

      renderAuth(queryClient);

      await waitFor(() =>
        expect(screen.getByText("indeterminate")).toBeInTheDocument(),
      );
    },
  );

  it("removes the active offline identity after a confirmed invalid session", async () => {
    const queryClient = new QueryClient();
    saveOfflineIdentity({
      id: "user-a",
      organizationId: "tenant-a",
      role: "OWNER",
      organizationStatus: "ACTIVE",
    });
    api.refreshToken.mockRejectedValueOnce({ status: 401 });

    renderAuth(queryClient);

    await waitFor(() => expect(getOfflineIdentity()).toBeNull());
  });

  it("preserves a named durable workspace after logout and reopens it for the same user", async () => {
    const queryClient = new QueryClient();
    const store = createDurableStore();
    api.refreshToken.mockResolvedValueOnce({
      data: { accessToken: "restored-access-token" },
    });
    api.getCurrentUser.mockResolvedValueOnce({ data: tenantA });
    renderAuthWithOffline(queryClient, store);

    await screen.findByText("pending");
    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() =>
      expect(screen.getByText("signed-out")).toBeInTheDocument(),
    );
    await expect(
      store.getCustomers({ organizationId: "tenant-a", userId: "user-a" }),
    ).resolves.toEqual([{ id: "customer-a" }]);
    await expect(
      store.listOutbox({ organizationId: "tenant-a", userId: "user-a" }, 1),
    ).resolves.toEqual([{ operation_id: "queued-a" }]);
    expect(store.clearWorkspace).not.toHaveBeenCalled();

    api.getCurrentUser.mockResolvedValueOnce({ data: tenantA });
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() =>
      expect(store.open).toHaveBeenLastCalledWith({
        organizationId: "tenant-a",
        userId: "user-a",
      }),
    );
  });

  it("preserves durable queued data after a confirmed 401 and reopens the same namespace", async () => {
    const queryClient = new QueryClient();
    const store = createDurableStore();
    api.refreshToken.mockResolvedValueOnce({
      data: { accessToken: "restored-access-token" },
    });
    api.getCurrentUser.mockResolvedValueOnce({ data: tenantA });
    renderAuthWithOffline(queryClient, store);

    await screen.findByText("pending");
    api.getCurrentUser.mockRejectedValueOnce({ status: 401 });
    api.refreshToken.mockRejectedValueOnce({ status: 401 });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() =>
      expect(screen.getByText("signed-out")).toBeInTheDocument(),
    );
    await expect(
      store.listOutbox({ organizationId: "tenant-a", userId: "user-a" }, 1),
    ).resolves.toEqual([{ operation_id: "queued-a" }]);
    expect(store.clearWorkspace).not.toHaveBeenCalled();

    api.getCurrentUser.mockResolvedValueOnce({ data: tenantA });
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() =>
      expect(store.open).toHaveBeenLastCalledWith({
        organizationId: "tenant-a",
        userId: "user-a",
      }),
    );
  });

  it("replaces the saved identity before exposing a different authoritative tenant", async () => {
    const queryClient = new QueryClient();
    saveOfflineIdentity({
      id: "user-a",
      organizationId: "tenant-a",
      role: "OWNER",
      organizationStatus: "ACTIVE",
    });
    api.refreshToken.mockResolvedValueOnce({
      data: { accessToken: "restored-access-token" },
    });
    api.getCurrentUser.mockResolvedValueOnce({ data: tenantB });

    renderAuth(queryClient);

    await waitFor(() => {
      expect(screen.getByText("tenant-b")).toBeInTheDocument();
      expect(getOfflineIdentity()).toEqual({
        id: "user-b",
        organizationId: "tenant-b",
        role: "OWNER",
        organizationStatus: "ACTIVE",
      });
    });
  });

  it("keeps session restoration recoverable after a network refresh failure", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["/api/vehicles"], [{ id: "vehicle-a" }]);
    api.refreshToken.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    renderAuth(queryClient);

    await waitFor(() => {
      expect(screen.getByText("indeterminate")).toBeInTheDocument();
      expect(queryClient.getQueryData(["/api/vehicles"])).toEqual([
        { id: "vehicle-a" },
      ]);
    });
  });

  it("restores the session when retrying after a network refresh failure", async () => {
    const queryClient = new QueryClient();
    api.refreshToken
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({
        data: { accessToken: "restored-access-token" },
      });
    api.getCurrentUser.mockResolvedValueOnce({ data: tenantA });

    renderAuth(queryClient);

    await screen.findByText("indeterminate");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.getByText("tenant-a")).toBeInTheDocument();
      expect(getAccessToken()).toBe("restored-access-token");
    });
  });

  it("keeps session restoration indeterminate after a 5xx refresh failure", async () => {
    const queryClient = new QueryClient();
    api.refreshToken.mockRejectedValueOnce({ status: 503 });

    renderAuth(queryClient);

    await waitFor(() => {
      expect(screen.getByText("indeterminate")).toBeInTheDocument();
    });
  });

  it("clears tenant cache when /auth/me returns no current user", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["/api/vehicles"], [{ id: "vehicle-a" }]);
    setAccessToken("access-token");
    api.getCurrentUser.mockResolvedValueOnce({ data: null });

    renderAuth(queryClient);

    await waitFor(() => {
      expect(screen.getByText("signed-out")).toBeInTheDocument();
      expect(queryClient.getQueryData(["/api/vehicles"])).toBeUndefined();
    });
  });
});
