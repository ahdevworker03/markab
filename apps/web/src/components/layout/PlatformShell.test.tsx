import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlatformShell } from "./PlatformShell";

vi.mock("wouter", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useLocation: () => ["/platform", vi.fn()],
}));
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

describe("PlatformShell", () => {
  it("shows the workspace identity, sign-out, and only implemented navigation", () => {
    render(
      <PlatformShell>
        <p>المحتوى</p>
      </PlatformShell>,
    );

    expect(screen.getByRole("link", { name: "إدارة المنصة — مَركب" })).toHaveAttribute("href", "/platform");
    expect(screen.getByText("إدارة المنصة")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تسجيل الخروج" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("المحتوى");
    for (const future of ["الاشتراكات", "التحليلات", "الفوترة", "التدقيق", "الإعدادات"]) {
      expect(screen.queryByText(future)).not.toBeInTheDocument();
    }
  });

  it("provides a skip link to the main content", () => {
    render(<PlatformShell>x</PlatformShell>);

    expect(screen.getByRole("link", { name: "الانتقال إلى المحتوى الرئيسي" })).toHaveAttribute("href", "#platform-main");
    expect(screen.getByRole("main")).toHaveAttribute("id", "platform-main");
  });
});
