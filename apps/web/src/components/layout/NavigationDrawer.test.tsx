import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { NavigationDrawer } from "./NavigationDrawer";

vi.mock("./LogoutButton", () => ({
  LogoutButton: () => <button type="button">تسجيل الخروج</button>,
}));

describe("NavigationDrawer", () => {
  it("reserves header space for the logical-end close button", () => {
    render(<ThemeProvider><NavigationDrawer open onOpenChange={vi.fn()} /></ThemeProvider>);

    expect(screen.getByRole("button", { name: "إغلاق" })).toHaveClass(
      "absolute",
      "end-4",
      "top-4",
      "size-11",
    );
    expect(screen.getByText("كل الوحدات").parentElement?.parentElement).toHaveClass(
      "pe-12",
    );
  });

  it("closes through the close button and Escape", () => {
    const onOpenChange = vi.fn();
    render(<ThemeProvider><NavigationDrawer open onOpenChange={onOpenChange} /></ThemeProvider>);

    fireEvent.click(screen.getByRole("button", { name: "إغلاق" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    onOpenChange.mockClear();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("uses readable toggle colors on the drawer surface", () => {
    render(<ThemeProvider><NavigationDrawer open onOpenChange={vi.fn()} /></ThemeProvider>);

    expect(screen.getByRole("button", { name: "تفعيل الوضع الليلي" })).toHaveClass("text-foreground");
  });
});
