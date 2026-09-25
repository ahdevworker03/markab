import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  refreshToken as apiRefreshToken,
  setAuthRefreshHandler,
} from "@workspace/api-client-react";
import type { CurrentUserResponse } from "@workspace/api-client-react";
import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
} from "@/lib/auth-token";
import {
  clearOfflineIdentity,
  getOfflineIdentity,
  saveOfflineIdentity,
  type OfflineSessionIdentity,
} from "@/features/offline/session";

interface LoginParams {
  email: string;
  password: string;
}

interface AuthContextValue {
  user: CurrentUserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionState:
    "unauthenticated" | "indeterminate" | "offline" | "authenticated";
  offlineIdentity: OfflineSessionIdentity | null;
  login: (params: LoginParams) => Promise<CurrentUserResponse>;
  logout: () => Promise<void>;
  retry: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

type RefreshResult = "restored" | "unauthenticated" | "indeterminate";

function isAuthenticationFailure(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 401
  );
}

function isNetworkFailure(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    [
      "Failed to fetch",
      "Load failed",
      "NetworkError when attempting to fetch resource.",
    ].includes(error.message)
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<CurrentUserResponse | null>(null);
  const [offlineIdentity, setOfflineIdentity] =
    useState<OfflineSessionIdentity | null>(getOfflineIdentity);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionState, setSessionState] =
    useState<AuthContextValue["sessionState"]>("unauthenticated");
  const refreshWasAttempted = useRef(false);
  const lastRefreshResult = useRef<RefreshResult | null>(null);

  const clearSession = useCallback(() => {
    queryClient.clear();
    clearAccessToken();
    clearOfflineIdentity();
    setUser(null);
    setOfflineIdentity(null);
    setSessionState("unauthenticated");
  }, [queryClient]);

  const restoreOfflineSession = useCallback(() => {
    const identity = getOfflineIdentity();
    if (
      identity &&
      (identity.organizationStatus === "ACTIVE" ||
        identity.organizationStatus === "TRIAL")
    ) {
      setUser(null);
      setOfflineIdentity(identity);
      setSessionState("offline");
      return;
    }
    setUser(null);
    setSessionState("indeterminate");
  }, []);

  const handleRestorationFailure = useCallback(
    (error: unknown) => {
      if (isNetworkFailure(error)) {
        restoreOfflineSession();
        return;
      }
      setUser(null);
      setSessionState("indeterminate");
    },
    [restoreOfflineSession],
  );

  const refreshSession = useCallback(async (): Promise<RefreshResult> => {
    try {
      const refreshed = await apiRefreshToken();
      setAccessToken(refreshed.data.accessToken);
      lastRefreshResult.current = "restored";
      return "restored";
    } catch (error) {
      if (isAuthenticationFailure(error)) {
        clearSession();
        lastRefreshResult.current = "unauthenticated";
        return "unauthenticated";
      }

      handleRestorationFailure(error);
      lastRefreshResult.current = "indeterminate";
      return "indeterminate";
    }
  }, [clearSession, handleRestorationFailure]);

  useEffect(() => {
    setAuthRefreshHandler(async () => {
      refreshWasAttempted.current = true;
      return (await refreshSession()) === "restored";
    });
    return () => setAuthRefreshHandler(null);
  }, [refreshSession]);

  const restoreSession = useCallback(async () => {
    setIsLoading(true);
    setSessionState("unauthenticated");
    refreshWasAttempted.current = false;
    lastRefreshResult.current = null;

    const loadCurrentUser = async () => {
      const result = await getCurrentUser();

      if (!result?.data) {
        clearSession();
        return;
      }

      queryClient.clear();
      setOfflineIdentity(saveOfflineIdentity(result.data));
      setUser(result.data);
      setSessionState("authenticated");
    };

    const loadAfterRefresh = async () => {
      if ((await refreshSession()) !== "restored") return;

      try {
        await loadCurrentUser();
      } catch (error) {
        if (!isAuthenticationFailure(error)) {
          handleRestorationFailure(error);
        } else if (
          !refreshWasAttempted.current ||
          lastRefreshResult.current === "restored"
        ) {
          clearSession();
        }
      }
    };

    try {
      if (!getAccessToken()) {
        await loadAfterRefresh();
        return;
      }

      await loadCurrentUser();
    } catch (error) {
      if (!isAuthenticationFailure(error)) {
        handleRestorationFailure(error);
        return;
      }

      if (refreshWasAttempted.current) {
        if (lastRefreshResult.current === "restored") clearSession();
        return;
      }

      await loadAfterRefresh();
    } finally {
      setIsLoading(false);
    }
  }, [clearSession, handleRestorationFailure, queryClient, refreshSession]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const login = useCallback(
    async ({ email, password }: LoginParams) => {
      clearSession();

      try {
        const result = await apiLogin({ email, password });
        setAccessToken(result.data.accessToken);

        const me = await getCurrentUser();
        if (!me?.data) throw new Error("Invalid current user response.");

        setOfflineIdentity(saveOfflineIdentity(me.data));
        setUser(me.data);
        setSessionState("authenticated");
        return me.data;
      } catch (error) {
        clearSession();
        throw error;
      }
    },
    [clearSession],
  );

  const logout = useCallback(async () => {
    clearSession();

    try {
      await apiLogout();
    } catch {
      // Ignore logout errors — clear the in-memory session regardless.
    }
  }, [clearSession]);

  const retry = useCallback(async () => {
    await restoreSession();
  }, [restoreSession]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      sessionState,
      offlineIdentity,
      login,
      logout,
      retry,
    }),
    [user, isLoading, sessionState, offlineIdentity, login, logout, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return ctx;
}
