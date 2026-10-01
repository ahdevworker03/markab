import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    if (import.meta.env.MODE !== "benchmark") return;

    (
      window as Window & { __benchmarkQueryClient?: QueryClient }
    ).__benchmarkQueryClient = queryClient;
    return () => {
      delete (window as Window & { __benchmarkQueryClient?: QueryClient })
        .__benchmarkQueryClient;
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
