import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import { LogoutButton } from "./LogoutButton";

interface PlatformShellProps {
  children: ReactNode;
}

export function PlatformShell({ children }: PlatformShellProps) {
  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#platform-main"
        className="sr-only fixed start-4 top-4 z-[60] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only"
      >
        الانتقال إلى المحتوى الرئيسي
      </a>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">إدارة المنصة</p>
              <p className="text-xs text-muted-foreground">مَركب</p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>
      <main
        id="platform-main"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7"
      >
        {children}
      </main>
    </div>
  );
}
