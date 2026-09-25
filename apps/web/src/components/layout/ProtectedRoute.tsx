import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/providers/AuthProvider";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/FeedbackState";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const {
    user,
    offlineIdentity,
    isAuthenticated,
    isLoading,
    retry,
    sessionState,
  } = useAuth();
  const [, setLocation] = useLocation();
  const identity = user ?? offlineIdentity;
  const hasTenantAccess =
    (isAuthenticated || sessionState === "offline") &&
    identity != null &&
    (identity.role === "OWNER" || identity.role === "EMPLOYEE");

  useEffect(() => {
    if (!isLoading && sessionState !== "indeterminate" && !hasTenantAccess) {
      setLocation(
        identity?.role === "PLATFORM_OWNER" ? "/platform" : "/login",
        { replace: true },
      );
    }
  }, [hasTenantAccess, identity?.role, isLoading, sessionState, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (sessionState === "indeterminate") {
    return (
      <ErrorState
        title="تعذر استعادة الجلسة"
        description="تحقق من الاتصال بالخادم ثم أعد المحاولة."
        onRetry={() => void retry()}
      />
    );
  }

  if (!hasTenantAccess) {
    return null;
  }

  return <>{children}</>;
}
