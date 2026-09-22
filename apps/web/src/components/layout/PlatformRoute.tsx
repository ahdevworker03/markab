import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/providers/AuthProvider";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/FeedbackState";

interface PlatformRouteProps {
  children: ReactNode;
}

export function PlatformRoute({ children }: PlatformRouteProps) {
  const { user, isLoading, retry, sessionState } = useAuth();
  const [, setLocation] = useLocation();
  const hasPlatformAccess = user?.role === "PLATFORM_OWNER";

  useEffect(() => {
    if (!isLoading && sessionState !== "indeterminate" && !hasPlatformAccess) {
      setLocation(user ? "/" : "/login", { replace: true });
    }
  }, [hasPlatformAccess, isLoading, sessionState, setLocation, user]);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
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

  return hasPlatformAccess ? <>{children}</> : null;
}
