import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/providers/AuthProvider";
import { Spinner } from "@/components/ui/spinner";

interface PlatformRouteProps {
  children: ReactNode;
}

export function PlatformRoute({ children }: PlatformRouteProps) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const hasPlatformAccess = user?.role === "PLATFORM_OWNER";

  useEffect(() => {
    if (!isLoading && !hasPlatformAccess) {
      setLocation(user ? "/" : "/login", { replace: true });
    }
  }, [hasPlatformAccess, isLoading, setLocation, user]);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return hasPlatformAccess ? <>{children}</> : null;
}
