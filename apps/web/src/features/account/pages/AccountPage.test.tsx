import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountPage } from "./AccountPage";

const TOKEN = "one-time-token-value-1234567890abcdefghijk";

const { inviteMutateAsync, inviteReset } = vi.hoisted(() => ({
  inviteMutateAsync: vi.fn(),
  inviteReset: vi.fn(),
}));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { role: "OWNER", email: "owner@example.com" } }),
}));
vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@/lib/api-error", () => ({
  getApiErrorMessage: () => ({ title: "تعذر تنفيذ الطلب" }),
}));
vi.mock("@workspace/api-client-react", () => ({
  useGetMyOrganization: () => ({
    data: { data: { name: "مؤسسة الاختبار", email: null } },
    refetch: vi.fn(),
  }),
  useUpdateMyOrganization: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateEmployeeInvitation: () => ({
    mutateAsync: inviteMutateAsync,
    reset: inviteReset,
    isPending: false,
  }),
}));

async function sendInvitation() {
  fireEvent.change(screen.getByLabelText("بريد الموظف"), {
    target: { value: "employee@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "إنشاء رابط دعوة" }));
  await screen.findByLabelText("رابط الدعوة");
}

describe("AccountPage employee invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inviteMutateAsync.mockResolvedValue({
      data: {
        id: "inv-1",
        email: "employee@example.com",
        role: "EMPLOYEE",
        expiresAt: "2026-10-07T12:00:00.000Z",
        acceptanceToken: TOKEN,
        createdAt: "2026-09-30T12:00:00.000Z",
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not expose any invitation link before an invitation is created", () => {
    render(<AccountPage />);

    expect(screen.queryByLabelText("رابط الدعوة")).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(TOKEN);
  });

  it("shows a usable acceptance link built from the app origin once creation succeeds", async () => {
    render(<AccountPage />);

    await sendInvitation();

    const link = (screen.getByLabelText("رابط الدعوة") as HTMLInputElement).value;
    const url = new URL(link);
    expect(url.origin).toBe(window.location.origin);
    expect(url.pathname.endsWith("/accept-invitation")).toBe(true);
    expect(url.searchParams.get("token")).toBe(TOKEN);
    expect(screen.getByText(/وسيلة تواصل آمنة/)).toBeInTheDocument();
    expect(inviteMutateAsync).toHaveBeenCalledWith({
      data: { email: "employee@example.com" },
    });
    expect(inviteReset).toHaveBeenCalled();
  });

  it("copies the link and removes it when dismissed", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<AccountPage />);
    await sendInvitation();
    const link = (screen.getByLabelText("رابط الدعوة") as HTMLInputElement).value;

    fireEvent.click(screen.getByRole("button", { name: "نسخ الرابط" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(link));
    expect(await screen.findByText("تم النسخ")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "تم، إخفاء الرابط" }));
    expect(screen.queryByLabelText("رابط الدعوة")).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(TOKEN);
  });

  it("falls back to manual copy when the clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    render(<AccountPage />);
    await sendInvitation();

    fireEvent.click(screen.getByRole("button", { name: "نسخ الرابط" }));

    expect(await screen.findByText(/انسخه يدوياً/)).toBeInTheDocument();
  });

  it("never persists the token in browser storage", async () => {
    const setLocal = vi.spyOn(Storage.prototype, "setItem");
    render(<AccountPage />);

    await sendInvitation();

    expect(setLocal).not.toHaveBeenCalled();
    expect(JSON.stringify({ ...localStorage })).not.toContain(TOKEN);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(TOKEN);
  });

  it("replaces the shown link when a new invitation is issued", async () => {
    render(<AccountPage />);
    await sendInvitation();
    inviteMutateAsync.mockResolvedValueOnce({
      data: {
        id: "inv-1",
        email: "employee@example.com",
        role: "EMPLOYEE",
        expiresAt: "2026-10-08T12:00:00.000Z",
        acceptanceToken: "second-token-value-1234567890abcdefghijkl",
        createdAt: "2026-10-01T12:00:00.000Z",
      },
    });

    fireEvent.change(screen.getByLabelText("بريد الموظف"), {
      target: { value: "employee@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "إنشاء رابط دعوة" }));

    await waitFor(() =>
      expect(
        (screen.getByLabelText("رابط الدعوة") as HTMLInputElement).value,
      ).toContain("second-token-value"),
    );
    expect(document.body.innerHTML).not.toContain(TOKEN);
  });
});
