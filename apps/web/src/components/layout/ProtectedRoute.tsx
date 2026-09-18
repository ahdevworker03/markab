import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/providers/AuthProvider";
import { Spinner } from "@/components/ui/spinner";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const hasTenantAccess =
    isAuthenticated &&
    user !== null &&
    (user.role === "OWNER" || user.role === "EMPLOYEE");

  useEffect(() => {
    if (!isLoading && !hasTenantAccess) {
      setLocation("/login", { replace: true });
    }
  }, [hasTenantAccess, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!hasTenantAccess) {
    return null;
  }

  return <>{children}</>;
}
