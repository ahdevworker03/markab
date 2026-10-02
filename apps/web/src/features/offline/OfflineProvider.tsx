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
  const { user, offlineIdentity } = useAuth();
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
  const [status, setStatus] = useState<OfflineStatus>("authenticationRequired");
  const [syncReady, setSyncReady] = useState(false);
  const [projectionVersion, setProjectionVersion] = useState(0);
  const syncRef = useRef<ReturnType<typeof createSyncCoordinator> | undefined>(
    undefined,
  );

  const syncNow = (): void => {
    void syncRef.current?.syncNow().catch(() => undefined);
  };
  const refreshProjections = useCallback(() => {
    setProjectionVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    setPendingCount(0);
    setConflicts([]);
    setSyncReady(false);
    setStatus("pending");

    if (!workspace) {
      setStatus("authenticationRequired");
      return;
    }
    if (!available) {
      setStatus("organizationUnavailable");
      return;
    }

    let active = true;
    const openWorkspace = async () => {
      try {
        await store.open(workspace);
        if (!active) return;
        if ("syncPush" in api && "syncPull" in api) {
          syncRef.current = createSyncCoordinator({
            workspace,
            store,
            push: api.syncPush,
            pull: api.syncPull,
            onStatus: (next: SyncStatusUpdate) => {
              if (!active) return;
              setPendingCount(next.pendingCount);
              setConflicts(next.conflicts);
              if (next.reachable !== undefined) setIsOnline(next.reachable);
              setStatus(next.status);
              refreshProjections();
            },
          });
          setSyncReady(true);
          void syncRef.current.start().catch(() => undefined);
        }
      } catch {
        if (active) setStatus("failed");
      }
    };

    const syncOnOnline = () => {
      if (active) syncNow();
    };
    window.addEventListener("online", syncOnOnline);
    window.addEventListener("focus", syncOnOnline);
    void openWorkspace();
    return () => {
      active = false;
      setSyncReady(false);
      syncRef.current?.stop();
      syncRef.current = undefined;
      window.removeEventListener("online", syncOnOnline);
      window.removeEventListener("focus", syncOnOnline);
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
        isOnline,
        pendingCount,
        syncNow,
        conflicts,
        isOffline: status === "offline",
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
