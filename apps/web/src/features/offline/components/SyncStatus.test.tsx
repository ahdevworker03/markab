import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncStatus } from "./SyncStatus";

const useOffline = vi.hoisted(() => vi.fn());

vi.mock("../OfflineProvider", () => ({ useOffline }));

describe("SyncStatus", () => {
  beforeEach(() => {
    useOffline.mockReturnValue({ status: "upToDate", pendingCount: 0 });
  });

  it("shows the number of pending changes", () => {
    useOffline.mockReturnValue({ status: "pending", pendingCount: 2 });

    render(<SyncStatus />);

    expect(
      screen.getByRole("status", { name: "2 تغييرات بانتظار المزامنة" }),
    ).toHaveAttribute("data-state", "pending");
  });

  it("announces that the workspace is offline", () => {
    useOffline.mockReturnValue({ status: "offline", pendingCount: 0 });

    render(<SyncStatus />);

    expect(screen.getByRole("status", { name: "غير متصل" })).toHaveAttribute(
      "data-state",
      "offline",
    );
  });

  it("opens the resolution dialog for changes that need review", () => {
    useOffline.mockReturnValue({
      status: "conflict",
      pendingCount: 1,
      conflicts: [],
      workspace: null,
      store: {},
      refreshProjections: vi.fn(),
      syncNow: vi.fn(),
    });

    render(<SyncStatus />);

    fireEvent.click(
      screen.getByRole("button", { name: "تحتاج التغييرات إلى مراجعة" }),
    );

    expect(
      screen.getByRole("heading", { name: "مراجعة التغييرات" }),
    ).toBeInTheDocument();
  });

  it("does not occupy the app shell when up to date", () => {
    const { container } = render(<SyncStatus />);

    expect(container).toBeEmptyDOMElement();
  });
});
