import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ExpenseResponse } from "@workspace/api-client-react";
import { ExpensesDataList } from "./ExpensesDataList";

const expense = {
  id: "expense-1",
  vehicleId: "vehicle-1",
  expenseDate: "2026-08-01T09:00:00.000Z",
  amount: 125,
  category: "FUEL",
  description: "Fuel refill",
} as ExpenseResponse;

describe("ExpensesDataList", () => {
  it("aligns vehicle text to the table header and preserves the detail action", () => {
    const onOpen = vi.fn();
    render(
      <ExpensesDataList
        items={[
          {
            expense,
            vehicleName: "Kia Pilot 3",
            vehiclePlate: "BM-1-003",
          },
        ]}
        onOpen={onOpen}
      />,
    );

    const table = screen.getByRole("table");
    const tableContent = within(table);
    const vehicleHeader = tableContent.getByRole("columnheader", {
      name: "السيارة",
    });
    const vehicleName = tableContent.getByText("Kia Pilot 3");
    const vehiclePlate = tableContent.getByText("BM-1-003");
    const vehicleTextBlock = vehicleName.parentElement;
    const vehicleValue = vehicleTextBlock?.parentElement;

    expect(vehicleHeader).toHaveClass("text-start");
    expect(vehicleValue).toHaveAttribute("dir", "rtl");
    expect(vehicleTextBlock).toHaveClass("min-w-0", "flex-1", "text-end");
    expect(vehicleTextBlock).toContainElement(vehiclePlate);
    expect(vehicleName).toHaveAttribute("dir", "ltr");
    expect(vehiclePlate).toHaveAttribute("dir", "ltr");
    expect(vehicleValue?.firstElementChild).toBe(vehicleTextBlock);
    expect(vehicleValue?.lastElementChild?.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    fireEvent.click(tableContent.getByRole("button", { name: /عرض التفاصيل/ }));
    expect(onOpen).toHaveBeenCalledWith(expense.id);
  });
});
