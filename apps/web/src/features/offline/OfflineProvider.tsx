import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/providers/AuthProvider";
import { createOfflineStore } from "./storage";
import { createSyncCoordinator, type SyncStatusUpdate } from "./sync";
import type { OfflineStore, OfflineWorkspace } from "./types";
import * as api from "@workspace/api-client-react";

export type OfflineStatus =
  | "offline"
  | "pending"
  | "synchronizing"
  | "upToDate"
  | "failed"
  | "conflict"
  | "authenticationRequired"
  | "organizationUnavailable";

type OfflineContextValue = {
  status: OfflineStatus;
  isOnline: boolean;
  pendingCount: number;
  syncNow: () => void;
  markOffline: () => void;
  conflicts: unknown[];
  isOffline: boolean;
  syncReady: boolean;
  workspace: OfflineWorkspace | null;
  store: OfflineStore;
  projectionVersion: number;
  refreshProjections: () => void;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);
const defaultStore = createOfflineStore();

function canUseTenantWorkspace(
  identity: { id: string; organizationId: string; role: string } | null,
): identity is {
  id: string;
  organizationId: string;
  role: "OWNER" | "EMPLOYEE";
} {
  return (
    identity !== null &&
    (identity.role === "OWNER" || identity.role === "EMPLOYEE")
  );
}

function isAvailableOrganization(status: string): boolean {
  return status === "ACTIVE" || status === "TRIAL";
}

function connectivityHint(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

interface OfflineProviderProps {
  children: ReactNode;
  store?: OfflineStore;
}

export function OfflineProvider({
  children,
  store = defaultStore,
}: OfflineProviderProps) {
  const { user, offlineIdentity, sessionState } = useAuth();
  const identity = user ?? offlineIdentity;
  const workspace: OfflineWorkspace | null = canUseTenantWorkspace(identity)
    ? { organizationId: identity.organizationId, userId: identity.id }
    : null;
  const available = identity
    ? isAvailableOrganization(identity.organizationStatus)
    : true;
  const [isOnline, setIsOnline] = useState(connectivityHint);
  const [pendingCount, setPendingCount] = useState(0);
  const [conflicts, setConflicts] = useState<unknown[]>([]);
  const pendingCountRef = useRef(0);
  const [status, setStatus] = useState<OfflineStatus>("authenticationRequired");
  const [syncReady, setSyncReady] = useState(false);
  const [projectionVersion, setProjectionVersion] = useState(0);
  const syncRef = useRef<{ syncNow(): Promise<void> } | undefined>(undefined);
  const sessionStateRef = useRef(sessionState);
  const forcedOfflineRef = useRef(false);
  sessionStateRef.current = sessionState;

  const syncNow = (): void => {
    forcedOfflineRef.current = false;
    void syncRef.current?.syncNow().catch(() => undefined);
  };
  const markOffline = useCallback(() => {
    forcedOfflineRef.current = true;
    setIsOnline(false);
    setStatus("offline");
  }, []);
  const refreshProjections = useCallback(() => {
    setProjectionVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    if (sessionState === "offline") {
      setStatus("offline");
    } else if (workspace && available && !forcedOfflineRef.current && connectivityHint()) {
      setStatus("pending");
    }
  }, [available, sessionState, workspace]);

  useEffect(() => {
    pendingCountRef.current = 0;
    setPendingCount(0);
    setConflicts([]);
    setSyncReady(false);

    if (!workspace) {
      setStatus("authenticationRequired");
      return;
    }
    if (!available) {
      setStatus("organizationUnavailable");
      return;
    }

    let active = true;
    let onlineListenerRegistered = false;
    const updateStatus = (count: number, online: boolean) => {
      if (!active) return;
      pendingCountRef.current = count;
      setPendingCount(count);
      const reachable = !forcedOfflineRef.current && online;
      setIsOnline(reachable);
      setStatus(
        sessionStateRef.current === "offline" || !reachable
          ? "offline"
          : "pending",
      );
    };
    const openWorkspace = async () => {
      try {
        await store.open(workspace);
        if (!active) return;
        const outbox = await store.listOutbox(workspace, 2 ** 32 - 1);
        updateStatus(outbox.length, connectivityHint());
        setConflicts(
          outbox.filter((operation) => operation.state === "CONFLICT"),
        );
        if ("syncPush" in api && "syncPull" in api) {
          syncRef.current = createSyncCoordinator({
            workspace,
            store,
            push: api.syncPush,
            pull: api.syncPull,
            onStatus: (next: SyncStatusUpdate) => {
              if (!active) return;
              pendingCountRef.current = next.pendingCount;
              setPendingCount(next.pendingCount);
              setConflicts(next.conflicts);
              setStatus(
                sessionStateRef.current === "offline" || forcedOfflineRef.current || !connectivityHint()
                  ? "offline"
                  : next.status,
              );
              refreshProjections();
            },
          });
          if (onlineListenerRegistered) setSyncReady(true);
        }
      } catch {
        if (active) setStatus("failed");
      }
    };

    const updateConnectivity = () => {
      if (!active) return;
      const online = connectivityHint();
      setIsOnline(online);
      if (!online) setStatus("offline");
    };
    const syncOnOnline = () => {
      forcedOfflineRef.current = false;
      updateConnectivity();
      syncNow();
    };
    window.addEventListener("online", syncOnOnline);
    window.addEventListener("offline", updateConnectivity);
    onlineListenerRegistered = true;
    void openWorkspace();
    return () => {
      active = false;
      setSyncReady(false);
      if (syncRef.current) syncRef.current = undefined;
      window.removeEventListener("online", syncOnOnline);
      window.removeEventListener("offline", updateConnectivity);
      void store.close();
    };
  }, [
    available,
    refreshProjections,
    store,
    workspace?.organizationId,
    workspace?.userId,
  ]);

  return (
    <OfflineContext.Provider
      value={{
        status,
        isOnline: sessionState === "offline" ? false : isOnline,
        pendingCount,
        syncNow,
        markOffline,
        conflicts,
        isOffline: sessionState === "offline" || status === "offline",
        syncReady,
        workspace: workspace && available ? workspace : null,
        store,
        projectionVersion,
        refreshProjections,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline(): OfflineContextValue {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error("useOffline must be used within an OfflineProvider");
  }
  return context;
}
