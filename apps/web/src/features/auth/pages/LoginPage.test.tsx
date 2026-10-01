import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./LoginPage";

const login = vi.fn();
const setLocation = vi.fn();

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ login }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/login", setLocation],
}));

describe("LoginPage", () => {
  beforeEach(() => {
    login.mockReset();
    setLocation.mockReset();
  });

  it("associates the visible labels with the login controls", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText("البريد الإلكتروني*")).toHaveAttribute(
      "id",
      "login-email",
    );
    expect(screen.getByLabelText("كلمة المرور*")).toHaveAttribute(
      "id",
      "login-password",
    );
  });

  it("uses a submit control and does not expose public company registration", () => {
    render(<LoginPage />);

    expect(screen.getByRole("button", { name: "دخول" })).toHaveAttribute(
      "type",
      "submit",
    );
    expect(screen.queryByText("إنشاء حساب الشركة")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /إنشاء حساب|تسجيل شركة|حساب جديد|register|sign up/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "نسيت كلمة المرور؟" })).toBeInTheDocument();
  });

  it("shows authentication failures as alert feedback", async () => {
    login.mockRejectedValueOnce(new Error("failed"));
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("البريد الإلكتروني*"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("كلمة المرور*"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "دخول" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "حدث خطأ في الاتصال بالخادم.",
    );
  });

  it("redirects platform owners to the platform console", async () => {
    login.mockResolvedValueOnce({ role: "PLATFORM_OWNER" });
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("البريد الإلكتروني*"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("كلمة المرور*"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "دخول" }));
    await screen.findByRole("button", { name: "دخول" });
    expect(setLocation).toHaveBeenCalledWith("/platform", { replace: true });
  });
});
