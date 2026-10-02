import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineProvider, useOffline } from "./OfflineProvider";
import type { OfflineStore, QueuedOperation } from "./types";

const useAuth = vi.hoisted(() => vi.fn());
const syncPush = vi.hoisted(() => vi.fn());
const syncPull = vi.hoisted(() => vi.fn());

vi.mock("@/providers/AuthProvider", () => ({ useAuth }));
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  syncPush,
  syncPull,
}));

const tenant = {
  id: "user-a",
  organizationId: "organization-a",
  role: "OWNER" as const,
  organizationStatus: "ACTIVE" as const,
};

function createStore(): OfflineStore {
  return {
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getCustomers: vi.fn(),
    getCustomer: vi.fn(),
    getVehicles: vi.fn(),
    getVehicle: vi.fn(),
    getRental: vi.fn(),
    getCompletionCursor: vi.fn(),
    applyPull: vi.fn(),
    enqueue: vi.fn(),
    listOutbox: vi.fn().mockResolvedValue([]),
    getOutboxItem: vi.fn(),
    updateOutbox: vi.fn(),
    removeOutbox: vi.fn(),
    replaceCustomerConflict: vi.fn(),
    discardCustomerConflict: vi.fn(),
    discardActionRequired: vi.fn(),
    reconcileCustomerCreate: vi.fn(),
    clearWorkspace: vi.fn(),
  };
}

function OfflineProbe() {
  const { conflicts, isOnline, markOffline, pendingCount, status, syncNow, syncReady } = useOffline();
  return (
    <>
      <p>{`${status}:${isOnline}`}</p>
      <p>{`${pendingCount}:${conflicts.length}`}</p>
      <p>{String(syncReady)}</p>
      <button type="button" onClick={markOffline}>Mark offline</button>
      <button type="button" onClick={syncNow}>Sync now</button>
    </>
  );
}

describe("OfflineProvider", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    useAuth.mockReturnValue({
      user: {
        ...tenant,
        email: "owner@example.com",
        createdAt: "2026-01-01",
      },
      offlineIdentity: null,
      sessionState: "authenticated",
    });
  });

  afterEach(() => vi.clearAllMocks());

  it("keeps an authenticated workspace pending until Task 3 synchronizes it", async () => {
    const store = createStore();
    render(
      <OfflineProvider store={store}>
        <OfflineProbe />
      </OfflineProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("pending:true")).toBeInTheDocument(),
    );
    expect(store.open).toHaveBeenCalledWith({
      organizationId: "organization-a",
      userId: "user-a",
    });
    expect(screen.getByText("true")).toBeInTheDocument();
  });

  it("only marks sync ready after opening a tenant workspace", async () => {
    let resolveOpen!: () => void;
    const store = createStore();
    const auth: {
      user: (typeof tenant & { email: string; createdAt: string }) | null;
      offlineIdentity: null;
      sessionState: "authenticated" | "unauthenticated";
    } = {
      user: {
        ...tenant,
        email: "owner@example.com",
        createdAt: "2026-01-01",
      },
      offlineIdentity: null,
      sessionState: "authenticated",
    };
    store.open = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveOpen = resolve;
        }),
    );
    useAuth.mockImplementation(() => auth);

    const view = render(
      <OfflineProvider store={store}>
        <OfflineProbe />
      </OfflineProvider>,
    );

    expect(screen.getByText("false")).toBeInTheDocument();
    resolveOpen();

    await screen.findByText("true");
    auth.user = null;
    auth.sessionState = "unauthenticated";
    view.rerender(
      <OfflineProvider store={store}>
        <OfflineProbe />
      </OfflineProvider>,
    );

    expect(screen.getByText("false")).toBeInTheDocument();
    expect(store.close).toHaveBeenCalledTimes(1);
  });

  it("synchronizes when the browser comes online after initialization", async () => {
    const store = createStore();
    syncPush.mockResolvedValue({ results: [] });
    syncPull.mockResolvedValue({
      changes: [],
      next_cursor: null,
      completion_cursor: "complete",
    });
    render(
      <OfflineProvider store={store}>
        <OfflineProbe />
      </OfflineProvider>,
    );

    await screen.findByText("true");
    fireEvent.online(window);

    await waitFor(() => expect(syncPull).toHaveBeenCalledTimes(1));
  });

  it("keeps a validated tenant workspace available after an unreachable refresh", async () => {
    const store = createStore();
    useAuth.mockReturnValue({
      user: null,
      offlineIdentity: tenant,
      sessionState: "offline",
    });
    render(
      <OfflineProvider store={store}>
        <OfflineProbe />
      </OfflineProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("offline:false")).toBeInTheDocument(),
    );
    expect(store.open).toHaveBeenCalledWith({
      organizationId: "organization-a",
      userId: "user-a",
    });
  });

  it("does not initialize IndexedDB for a platform owner", () => {
    const store = createStore();
    useAuth.mockReturnValue({
      user: { ...tenant, role: "PLATFORM_OWNER" },
      offlineIdentity: null,
      sessionState: "authenticated",
    });
    render(
      <OfflineProvider store={store}>
        <OfflineProbe />
      </OfflineProvider>,
    );

    expect(store.open).not.toHaveBeenCalled();
  });

  it("treats offline events as connectivity hints without synchronizing", async () => {
    const store = createStore();
    render(
      <OfflineProvider store={store}>
        <OfflineProbe />
      </OfflineProvider>,
    );
    await screen.findByText("pending:true");
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    fireEvent.offline(window);

    expect(await screen.findByText("offline:false")).toBeInTheDocument();
    expect(store.listOutbox).toHaveBeenCalledTimes(1);
  });

  it("uses a failed supported mutation as an offline signal when the browser reports online", async () => {
    const store = createStore();
    render(
      <OfflineProvider store={store}>
        <OfflineProbe />
      </OfflineProvider>,
    );
    await screen.findByText("pending:true");

    fireEvent.click(screen.getByRole("button", { name: "Mark offline" }));

    await waitFor(() =>
      expect(screen.getByText("offline:false")).toBeInTheDocument(),
    );
  });

  it("recovers a queued transport failure through explicit sync without an online event", async () => {
    const operation: QueuedOperation = {
      operation_id: "queued-customer",
      type: "CUSTOMER_CREATE",
      customer_create: {
        first_name: "Ada",
        last_name: "Lovelace",
        phone: "10000000",
        address: "Beirut",
        national_id: "national-queued-customer",
        license_number: "license-queued-customer",
        license_expiry_date: "2030-01-01",
      },
      createdAt: "2026-09-23T12:00:00.000Z",
      attempts: 0,
      state: "PENDING",
    };
    let resolveInitialPull!: (value: {
      changes: [];
      next_cursor: null;
      completion_cursor: string;
    }) => void;
    const initialPull = new Promise<{
      changes: [];
      next_cursor: null;
      completion_cursor: string;
    }>((resolve) => {
      resolveInitialPull = resolve;
    });
    let outbox: QueuedOperation[] = [];
    const store = createStore();
    store.listOutbox = vi.fn().mockImplementation(async () => outbox);
    store.removeOutbox = vi.fn(async (_workspace, operationId) => {
      outbox = outbox.filter((item) => item.operation_id !== operationId);
    });
    syncPush.mockResolvedValue({
      results: [{
        operation_id: operation.operation_id,
        type: "CUSTOMER_CREATE",
        status: "APPLIED",
        code: "SYNC_APPLIED",
        resource_type: "CUSTOMER",
        customer: {
          id: "customer-queued",
          firstName: "Ada",
          lastName: "Lovelace",
          phone: "10000000",
          address: "Beirut",
          nationalId: "national-queued-customer",
          licenseNumber: "license-queued-customer",
          licenseExpiryDate: "2030-01-01",
          createdAt: "2026-09-23T12:00:00.000Z",
          updatedAt: "2026-09-23T12:00:00.000Z",
        },
      }],
    });
    syncPull.mockReturnValueOnce(initialPull).mockResolvedValueOnce({
      changes: [],
      next_cursor: null,
      completion_cursor: "complete",
    });
    render(
      <OfflineProvider store={store}>
        <OfflineProbe />
      </OfflineProvider>,
    );

    await screen.findByText("pending:true");
    await screen.findByText("true");
    fireEvent.online(window);
    await waitFor(() => expect(syncPull).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Mark offline" }));
    outbox = [operation];
    await screen.findByText("offline:false");
    resolveInitialPull({
      changes: [],
      next_cursor: null,
      completion_cursor: "complete",
    });
    fireEvent.click(screen.getByRole("button", { name: "Sync now" }));

    await waitFor(() => expect(store.removeOutbox).toHaveBeenCalledWith(
      { organizationId: "organization-a", userId: "user-a" },
      operation.operation_id,
    ));
    expect(syncPush).toHaveBeenCalledOnce();
    expect(syncPull).toHaveBeenCalledTimes(2);
  });

  it.each(["SUSPENDED", "CANCELLED"] as const)(
    "keeps durable queued data while stopping a %s organization workspace",
    async (organizationStatus) => {
      const store = createStore();
      const queued = [{ operation_id: "queued-a" }];
      store.listOutbox = vi.fn().mockResolvedValue(queued);
      useAuth.mockReturnValue({
        user: { ...tenant, organizationStatus },
        offlineIdentity: null,
        sessionState: "authenticated",
      });
      render(
        <OfflineProvider store={store}>
          <OfflineProbe />
        </OfflineProvider>,
      );

      expect(
        screen.getByText("organizationUnavailable:true"),
      ).toBeInTheDocument();
      expect(store.open).not.toHaveBeenCalled();
      await expect(
        store.listOutbox(
          { organizationId: "organization-a", userId: "user-a" },
          1,
        ),
      ).resolves.toEqual(queued);
      expect(store.clearWorkspace).not.toHaveBeenCalled();
    },
  );

  it("does not read a stale workspace after its open finishes late", async () => {
    let resolveFirstOpen!: () => void;
    const firstOpen = new Promise<void>((resolve) => {
      resolveFirstOpen = resolve;
    });
    const store = createStore();
    store.open = vi
      .fn()
      .mockImplementationOnce(() => firstOpen)
      .mockResolvedValue(undefined);
    const auth = {
      user: {
        ...tenant,
        email: "owner@example.com",
        createdAt: "2026-01-01",
      },
      offlineIdentity: null,
      sessionState: "authenticated",
    };
    useAuth.mockImplementation(() => auth);
    const view = render(
      <OfflineProvider store={store}>
        <OfflineProbe />
      </OfflineProvider>,
    );
    await waitFor(() => expect(store.open).toHaveBeenCalledTimes(1));
    auth.user = {
      ...auth.user,
      id: "user-b",
      organizationId: "organization-b",
    };
    view.rerender(
      <OfflineProvider store={store}>
        <OfflineProbe />
      </OfflineProvider>,
    );

    resolveFirstOpen();

    await waitFor(() => expect(store.listOutbox).toHaveBeenCalledTimes(1));
    expect(store.listOutbox).toHaveBeenCalledWith(
      { organizationId: "organization-b", userId: "user-b" },
      expect.any(Number),
    );
  });

  it("clears pending state before opening a replacement workspace", async () => {
    let resolveSecondOpen!: () => void;
    const secondOpen = new Promise<void>((resolve) => {
      resolveSecondOpen = resolve;
    });
    const store = createStore();
    store.open = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => secondOpen);
    store.listOutbox = vi
      .fn()
      .mockResolvedValueOnce([
        { operation_id: "pending-a", state: "PENDING" },
        { operation_id: "conflict-a", state: "CONFLICT" },
      ])
      .mockResolvedValueOnce([]);
    const auth = {
      user: {
        ...tenant,
        email: "owner@example.com",
        createdAt: "2026-01-01",
      },
      offlineIdentity: null,
      sessionState: "authenticated",
    };
    useAuth.mockImplementation(() => auth);
    const view = render(
      <OfflineProvider store={store}>
        <OfflineProbe />
      </OfflineProvider>,
    );

    await screen.findByText("2:1");
    auth.user = {
      ...auth.user,
      id: "user-b",
      organizationId: "organization-b",
    };
    view.rerender(
      <OfflineProvider store={store}>
        <OfflineProbe />
      </OfflineProvider>,
    );

    expect(screen.getByText("pending:true")).toBeInTheDocument();
    expect(screen.getByText("0:0")).toBeInTheDocument();
    resolveSecondOpen();
  });

  it("does not start a second sync when session state changes mid-sync", async () => {
    let resolvePull!: (value: {
      changes: [];
      next_cursor: null;
      completion_cursor: string;
    }) => void;
    const firstPull = new Promise<{
      changes: [];
      next_cursor: null;
      completion_cursor: string;
    }>((resolve) => {
      resolvePull = resolve;
    });
    const store = createStore();
    const auth = {
      user: {
        ...tenant,
        email: "owner@example.com",
        createdAt: "2026-01-01",
      },
      offlineIdentity: null,
      sessionState: "authenticated",
    };
    syncPush.mockResolvedValue({ results: [] });
    syncPull.mockReturnValueOnce(firstPull);
    useAuth.mockImplementation(() => auth);
    const view = render(
      <OfflineProvider store={store}>
        <OfflineProbe />
      </OfflineProvider>,
    );

    await screen.findByText("pending:true");
    fireEvent.online(window);
    await waitFor(() => expect(syncPull).toHaveBeenCalledTimes(1));

    auth.sessionState = "offline";
    view.rerender(
      <OfflineProvider store={store}>
        <OfflineProbe />
      </OfflineProvider>,
    );
    auth.sessionState = "authenticated";
    view.rerender(
      <OfflineProvider store={store}>
        <OfflineProbe />
      </OfflineProvider>,
    );

    expect(store.open).toHaveBeenCalledTimes(1);
    fireEvent.online(window);
    expect(syncPull).toHaveBeenCalledTimes(1);

    resolvePull({
      changes: [],
      next_cursor: null,
      completion_cursor: "complete",
    });
  });
});
