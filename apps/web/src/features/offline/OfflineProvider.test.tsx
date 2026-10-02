import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineProvider, useOffline } from "./OfflineProvider";
import { createOfflineCommands } from "./commands";
import { isNetworkFailure } from "./network";
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
  role: "OWNER",
  organizationStatus: "ACTIVE",
};
const workspace = { organizationId: tenant.organizationId, userId: tenant.id };
const draft = {
  first_name: "Ada",
  last_name: "Lovelace",
  phone: "10000000",
  address: "Beirut",
  national_id: "national-a",
  license_number: "license-a",
  license_expiry_date: "2030-01-01",
};
const customer = {
  id: "customer-a",
  firstName: "Ada",
  lastName: "Lovelace",
  phone: "10000000",
  address: "Beirut",
  nationalId: "national-a",
  licenseNumber: "license-a",
  licenseExpiryDate: "2030-01-01",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};
const page = { changes: [], next_cursor: null, completion_cursor: "complete" };

function createStore(): OfflineStore {
  let outbox: QueuedOperation[] = [];
  let required = false;
  let notify: (() => void) | undefined;
  return {
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getCustomers: vi.fn(),
    getCustomer: vi.fn(),
    getVehicles: vi.fn(),
    getVehicle: vi.fn(),
    getRental: vi.fn(),
    getCompletionCursor: vi.fn(),
    requireReconciliation: vi.fn(async () => {
      required = true;
    }),
    isReconciliationRequired: vi.fn(async () => required),
    subscribeOutbox: vi.fn((_workspace, listener) => {
      notify = listener;
      return () => {
        notify = undefined;
      };
    }),
    applyPull: vi.fn(async (_workspace, _changes, _cursor, complete) => {
      if (complete) required = false;
    }),
    enqueue: vi.fn(async (_workspace, operation) => {
      outbox.push(operation);
      notify?.();
    }),
    listOutbox: vi.fn(async () => [...outbox]),
    getOutboxItem: vi.fn(),
    updateOutbox: vi.fn(),
    removeOutbox: vi.fn(async (_workspace, id) => {
      outbox = outbox.filter((item) => item.operation_id !== id);
    }),
    replaceCustomerConflict: vi.fn(),
    discardCustomerConflict: vi.fn(),
    discardActionRequired: vi.fn(),
    reconcileCustomerCreate: vi.fn(),
    clearWorkspace: vi.fn(),
  };
}

function Probe({
  mutate = async () => undefined,
}: {
  mutate?: () => Promise<void>;
}) {
  const {
    status,
    isOnline,
    pendingCount,
    syncReady,
    syncNow,
    store,
    workspace: current,
  } = useOffline();
  const submit = async () => {
    try {
      await mutate();
    } catch (error) {
      if (!isNetworkFailure(error) || !current) throw error;
      await createOfflineCommands({
        workspace: current,
        store,
        createOperationId: () => "operation-a",
      }).queueCustomerCreate(draft);
    }
  };
  return (
    <>
      <p>{`${status}:${isOnline}`}</p>
      <p>{`${pendingCount} pending`}</p>
      <p>{String(syncReady)}</p>
      <button onClick={syncNow}>Retry</button>
      <button onClick={() => void submit()}>Submit</button>
    </>
  );
}

describe("OfflineProvider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    useAuth.mockReturnValue({
      user: tenant,
      offlineIdentity: null,
      sessionState: "authenticated",
    });
    syncPull.mockResolvedValue(page);
    syncPush.mockImplementation(
      async ({ operations }: { operations: QueuedOperation[] }) => ({
        results: operations.map((operation) => ({
          operation_id: operation.operation_id,
          type: operation.type,
          status: "APPLIED",
          code: "SYNC_APPLIED",
          resource_type: "CUSTOMER",
          customer,
        })),
      }),
    );
  });
  afterEach(() => vi.useRealTimers());

  it("initializes and completes startup sync without a browser event", async () => {
    const store = createStore();
    render(
      <OfflineProvider store={store}>
        <Probe />
      </OfflineProvider>,
    );
    await screen.findByText("upToDate:true");
    expect(store.open).toHaveBeenCalledWith(workspace);
    expect(syncPull).toHaveBeenCalledOnce();
    expect(screen.getByText("true")).toBeInTheDocument();
  });

  it("queues a genuine transport failure while navigator stays online and silently retries", async () => {
    const store = createStore();
    const mutation = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));
    render(
      <OfflineProvider store={store}>
        <Probe mutate={mutation} />
      </OfflineProvider>,
    );
    await screen.findByText("upToDate:true");
    vi.useFakeTimers();
    syncPush.mockRejectedValue(new TypeError("Failed to fetch"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    });
    expect(screen.getByText("offline:false")).toBeInTheDocument();
    expect(navigator.onLine).toBe(true);
    expect(await store.listOutbox(workspace, 25)).toHaveLength(1);
    expect(store.enqueue).toHaveBeenCalledWith(
      workspace,
      expect.objectContaining({
        localProjection: {
          customer: expect.objectContaining({ localId: "local:operation-a" }),
        },
      }),
    );
    syncPush.mockResolvedValue({
      results: [
        {
          operation_id: "operation-a",
          type: "CUSTOMER_CREATE",
          status: "APPLIED",
          code: "SYNC_APPLIED",
          resource_type: "CUSTOMER",
          customer,
        },
      ],
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByText("upToDate:true")).toBeInTheDocument();
    expect(await store.listOutbox(workspace, 25)).toEqual([]);
    expect(store.reconcileCustomerCreate).toHaveBeenCalledWith(
      workspace,
      "operation-a",
      customer,
    );
    expect(syncPush).toHaveBeenCalledTimes(2);
  });

  it.each(["online", "focus", "manual"])(
    "%s requests an immediate attempt",
    async (trigger) => {
      const store = createStore();
      render(
        <OfflineProvider store={store}>
          <Probe />
        </OfflineProvider>,
      );
      await screen.findByText("upToDate:true");
      if (trigger === "manual")
        fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      else fireEvent(window, new Event(trigger));
      await waitFor(() => expect(syncPull).toHaveBeenCalledTimes(2));
    },
  );

  it("does not let navigator offline hints override a successful API result", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    render(
      <OfflineProvider store={createStore()}>
        <Probe />
      </OfflineProvider>,
    );
    await screen.findByText("upToDate:true");
    fireEvent.offline(window);
    expect(screen.getByText("upToDate:true")).toBeInTheDocument();
  });

  it("retains an offline authenticated workspace and resumes persisted pending work", async () => {
    const store = createStore();
    await createOfflineCommands({ workspace, store }).queueCustomerCreate(
      draft,
    );
    useAuth.mockReturnValue({
      user: null,
      offlineIdentity: tenant,
      sessionState: "offline",
    });
    render(
      <OfflineProvider store={store}>
        <Probe />
      </OfflineProvider>,
    );
    await screen.findByText("upToDate:true");
    expect(syncPush).toHaveBeenCalledOnce();
    expect(await store.listOutbox(workspace, 25)).toEqual([]);
  });

  it("does not open a platform owner workspace", () => {
    const store = createStore();
    useAuth.mockReturnValue({
      user: { ...tenant, role: "PLATFORM_OWNER" },
      offlineIdentity: null,
    });
    render(
      <OfflineProvider store={store}>
        <Probe />
      </OfflineProvider>,
    );
    expect(store.open).not.toHaveBeenCalled();
    expect(screen.getByText("authenticationRequired:true")).toBeInTheDocument();
  });

  it.each(["SUSPENDED", "CANCELLED"])(
    "stops a %s workspace without deleting queued data",
    (organizationStatus) => {
      const store = createStore();
      useAuth.mockReturnValue({
        user: { ...tenant, organizationStatus },
        offlineIdentity: null,
      });
      render(
        <OfflineProvider store={store}>
          <Probe />
        </OfflineProvider>,
      );
      expect(
        screen.getByText("organizationUnavailable:true"),
      ).toBeInTheDocument();
      expect(store.open).not.toHaveBeenCalled();
      expect(store.clearWorkspace).not.toHaveBeenCalled();
    },
  );

  it("ignores an old workspace whose open resolves after a tenant change", async () => {
    const store = createStore();
    let resolveOpen!: () => void;
    store.open = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveOpen = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const view = render(
      <OfflineProvider store={store}>
        <Probe />
      </OfflineProvider>,
    );
    useAuth.mockReturnValue({
      user: { ...tenant, id: "user-b", organizationId: "organization-b" },
      offlineIdentity: null,
    });
    view.rerender(
      <OfflineProvider store={store}>
        <Probe />
      </OfflineProvider>,
    );
    await screen.findByText("upToDate:true");
    await act(async () => resolveOpen());
    for (const [current] of vi.mocked(store.listOutbox).mock.calls) {
      expect(current).toEqual({
        userId: "user-b",
        organizationId: "organization-b",
      });
    }
  });

  it("stops retries and event listeners on logout", async () => {
    const store = createStore();
    await createOfflineCommands({ workspace, store }).queueCustomerCreate(
      draft,
    );
    syncPush.mockRejectedValue(new TypeError("Failed to fetch"));
    const view = render(
      <OfflineProvider store={store}>
        <Probe />
      </OfflineProvider>,
    );
    await screen.findByText("offline:false");
    useAuth.mockReturnValue({
      user: null,
      offlineIdentity: null,
      sessionState: "unauthenticated",
    });
    view.rerender(
      <OfflineProvider store={store}>
        <Probe />
      </OfflineProvider>,
    );
    fireEvent.online(window);
    fireEvent.focus(window);
    expect(syncPush).toHaveBeenCalledOnce();
    expect(store.close).toHaveBeenCalledOnce();
    expect(await store.listOutbox(workspace, 25)).toHaveLength(1);
  });
});
