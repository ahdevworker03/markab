import type { ReactNode } from "react";
import { Link } from "wouter";
import { LogoutButton } from "./LogoutButton";

interface PlatformShellProps {
  children: ReactNode;
}

/** Minimal workspace frame for Platform Admin: brand, workspace label, sign-out, and a bounded content column. */
export function PlatformShell({ children }: PlatformShellProps) {
  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#platform-main"
        className="sr-only fixed start-4 top-4 z-[60] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only"
      >
        الانتقال إلى المحتوى الرئيسي
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-14 w-full max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/platform"
            aria-label="إدارة المنصة — مَركب"
            className="flex min-w-0 items-center gap-3 rounded-lg py-2"
          >
            <img
              src="/brand/logos/markab-logo-ar.png"
              alt=""
              className="markab-auth-logo-light -my-2 h-10 w-auto shrink-0"
            />
            <img
              src="/brand/logos/markab-logo-monochrome-light.png"
              alt=""
              className="markab-auth-logo-dark -my-2 h-10 w-auto shrink-0 object-contain"
            />
            <span className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
            <span className="truncate text-sm font-bold text-foreground">
              إدارة المنصة
            </span>
          </Link>
          <LogoutButton className="min-h-11 shrink-0 lg:min-h-9" />
        </div>
      </header>
      <main
        id="platform-main"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1200px] px-4 pb-5 pt-4 outline-none sm:px-6 sm:pb-8"
      >
        {children}
      </main>
    </div>
  );
}
