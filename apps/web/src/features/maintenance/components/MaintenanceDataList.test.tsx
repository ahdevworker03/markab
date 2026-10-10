import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MaintenanceResponse } from "@workspace/api-client-react";
import { MaintenanceDataList } from "./MaintenanceDataList";

const record = {
  id: "maintenance-1",
  vehicleId: "vehicle-1",
  type: "PREVENTIVE_SERVICE",
  status: "SCHEDULED",
  maintenanceDate: "2026-12-15T00:00:00.000Z",
  cost: 150,
} as MaintenanceResponse;

describe("MaintenanceDataList mobile cards", () => {
  it("keeps identity, metadata, cost and action grouped without the decorative car icon", () => {
    const onOpen = vi.fn();
    const { container } = render(
      <MaintenanceDataList
        items={[
          {
            record,
            vehicleName: "Toyota Corolla",
            vehiclePlate: "BM-1-003",
          },
        ]}
        onOpen={onOpen}
      />,
    );

    const mobileList = container.querySelector('[class~="md:hidden"]')!;
    const mobileCard = mobileList.querySelector("article")!;
    const card = within(mobileCard);
    const metadata = mobileCard.querySelector(".grid-cols-2")!;
    const bottomRow = mobileCard.lastElementChild!;

    expect(mobileCard).toHaveClass("space-y-3", "px-4", "py-3");
    expect(mobileList.querySelector("svg.lucide-car")).not.toBeInTheDocument();
    expect(card.getByText("Toyota Corolla")).toHaveAttribute("dir", "ltr");
    expect(card.getByText("BM-1-003")).toHaveAttribute("dir", "ltr");
    expect(card.getByText("مجدولة")).toBeInTheDocument();
    expect(metadata).toHaveClass("grid-cols-2");
    expect(card.getByText("النوع").parentElement).toContainElement(
      card.getByText("صيانة وقائية"),
    );
    expect(card.getByText("الموعد").parentElement).toContainElement(
      metadata.querySelector('[dir="ltr"]'),
    );
    expect(bottomRow).toContainElement(card.getByText("التكلفة"));
    expect(bottomRow).toContainElement(card.getByText("USD 150"));
    expect(bottomRow).toContainElement(
      card.getByRole("button", { name: "التفاصيل" }),
    );

    fireEvent.click(card.getByRole("button", { name: "التفاصيل" }));
    expect(onOpen).toHaveBeenCalledWith(record.id);
  });
});
