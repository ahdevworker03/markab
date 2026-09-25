import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncResolutionDialog } from "./SyncResolutionDialog";
import type { OfflineStore } from "../types";

const commands = vi.hoisted(() => ({
  discardCustomerConflict: vi.fn(),
  discardFailedOperation: vi.fn(),
  reapplyCustomerConflict: vi.fn(),
}));

vi.mock("../commands", () => ({
  createOfflineCommands: () => commands,
}));

const workspace = { organizationId: "organization-a", userId: "user-a" };
const currentCustomer = {
  id: "customer-a",
  firstName: "ليلى",
  lastName: "حسن",
  phone: "70123456",
  address: "بيروت",
  nationalId: "123",
  licenseNumber: "456",
  licenseExpiryDate: "2030-01-01",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("SyncResolutionDialog", () => {
  const listOutbox = vi.fn();
  const refreshProjections = vi.fn();
  const syncNow = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    listOutbox.mockResolvedValue([]);
  });

  it("reapplies a customer conflict against the retained server version", async () => {
    listOutbox.mockResolvedValue([
      {
        operation_id: "conflict-1",
        type: "CUSTOMER_UPDATE",
        state: "CONFLICT",
        attempts: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        customer_update: { customer_id: currentCustomer.id },
        result: { current_customer: currentCustomer },
      },
    ]);

    render(
      <SyncResolutionDialog
        open
        onOpenChange={vi.fn()}
        workspace={workspace}
        store={{ listOutbox } as unknown as OfflineStore}
        refreshProjections={refreshProjections}
        syncNow={syncNow}
      />,
    );

    await screen.findByText("تعارض في تعديل العميل");
    fireEvent.click(screen.getByRole("button", { name: "إعادة تطبيق التغيير" }));

    await waitFor(() =>
      expect(commands.reapplyCustomerConflict).toHaveBeenCalledWith(
        "conflict-1",
        currentCustomer,
      ),
    );
    expect(refreshProjections).toHaveBeenCalled();
    expect(syncNow).toHaveBeenCalled();
  });

  it("discards rejected and expired operations", async () => {
    listOutbox.mockResolvedValue([
      {
        operation_id: "rejected-1",
        type: "RENTAL_CREATE",
        state: "REJECTED",
        attempts: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        operation_id: "expired-1",
        type: "CUSTOMER_CREATE",
        state: "EXPIRED",
        attempts: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    render(
      <SyncResolutionDialog
        open
        onOpenChange={vi.fn()}
        workspace={workspace}
        store={{ listOutbox } as unknown as OfflineStore}
        refreshProjections={refreshProjections}
        syncNow={syncNow}
      />,
    );

    await screen.findByText("تعذر تنفيذ إنشاء الإيجار");
    fireEvent.click(screen.getAllByRole("button", { name: "تجاهل التغيير" })[0]);

    await waitFor(() =>
      expect(commands.discardFailedOperation).toHaveBeenCalledWith("rejected-1"),
    );
    expect(refreshProjections).toHaveBeenCalled();
  });

  it("keeps the dialog scoped to the current workspace when an earlier read resolves late", async () => {
    let resolveFirstRead: (operations: unknown[]) => void;
    const firstRead = new Promise<unknown[]>((resolve) => {
      resolveFirstRead = resolve;
    });
    listOutbox
      .mockImplementationOnce(() => firstRead)
      .mockResolvedValueOnce([
        {
          operation_id: "workspace-b",
          type: "RENTAL_CREATE",
          state: "REJECTED",
          attempts: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]);

    const { rerender } = render(
      <SyncResolutionDialog
        open
        onOpenChange={vi.fn()}
        workspace={workspace}
        store={{ listOutbox } as unknown as OfflineStore}
        refreshProjections={refreshProjections}
        syncNow={syncNow}
      />,
    );

    await waitFor(() => expect(listOutbox).toHaveBeenCalledWith(workspace, 2 ** 32 - 1));
    rerender(
      <SyncResolutionDialog
        open
        onOpenChange={vi.fn()}
        workspace={{ organizationId: "organization-b", userId: "user-b" }}
        store={{ listOutbox } as unknown as OfflineStore}
        refreshProjections={refreshProjections}
        syncNow={syncNow}
      />,
    );

    await screen.findByText("تعذر تنفيذ إنشاء الإيجار");
    await act(async () => {
      resolveFirstRead!([
        {
          operation_id: "workspace-a",
          type: "CUSTOMER_CREATE",
          state: "EXPIRED",
          attempts: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]);
      await firstRead;
    });

    expect(screen.queryByText("انتهت صلاحية إنشاء العميل")).not.toBeInTheDocument();
  });
});
