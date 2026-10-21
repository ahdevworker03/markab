import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VehicleResponse } from "@workspace/api-client-react";
import { VehiclesDataList } from "./VehiclesDataList";

const vehicle = {
  id: "vehicle-1",
  make: "Toyota",
  model: "Yaris",
  plateNumber: "TEST-8237",
  year: 2024,
  transmission: "AUTOMATIC",
  fuelType: "PETROL",
  seats: 5,
  currentMileage: 50000,
  status: "AVAILABLE",
} as unknown as VehicleResponse;

const initialViewportWidth = window.innerWidth;

function setViewportWidth(width: number, notify = false) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  if (notify) window.dispatchEvent(new Event("resize"));
}

afterEach(() => setViewportWidth(initialViewportWidth));

describe("VehiclesDataList", () => {
  it("shows vehicle identity, approved status, and Western mileage formatting", () => {
    render(<VehiclesDataList vehicles={[vehicle]} onOpen={vi.fn()} />);

    expect(screen.getAllByText("Toyota Yaris").length).toBeGreaterThan(0);
    expect(screen.getAllByText("TEST-8237").length).toBeGreaterThan(0);
    expect(screen.getAllByText("متاحة").length).toBeGreaterThan(0);
    expect(screen.getAllByText("50,000 كم").length).toBeGreaterThan(0);
  });

  it("opens the matching vehicle from a row action", () => {
    const onOpen = vi.fn();
    render(<VehiclesDataList vehicles={[vehicle]} onOpen={onOpen} />);

    fireEvent.click(screen.getAllByRole("button", { name: "عرض التفاصيل" })[0]);
    expect(onOpen).toHaveBeenCalledWith("vehicle-1");
  });

  it("renders only the mobile vehicle list at a mobile viewport", () => {
    setViewportWidth(393);

    render(<VehiclesDataList vehicles={[vehicle]} onOpen={vi.fn()} />);

    expect(screen.getAllByText("Toyota Yaris")).toHaveLength(1);
    expect(screen.getAllByText("TEST-8237")).toHaveLength(1);
  });

  it("changes the rendered list when the viewport crosses a breakpoint", () => {
    setViewportWidth(393);
    render(<VehiclesDataList vehicles={[vehicle]} onOpen={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "التفاصيل" }),
    ).toBeInTheDocument();

    act(() => setViewportWidth(1024, true));

    expect(
      screen.getByRole("button", { name: "عرض التفاصيل" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "التفاصيل" }),
    ).not.toBeInTheDocument();
  });

  it("omits the decorative car icon only from the mobile identity card", () => {
    setViewportWidth(393);
    const { container } = render(
      <VehiclesDataList vehicles={[vehicle]} onOpen={vi.fn()} />,
    );

    const mobileList = container.querySelector('[class~="md:hidden"]');

    expect(mobileList?.querySelector("svg.lucide-car")).not.toBeInTheDocument();
    expect(mobileList).toHaveTextContent("Toyota Yaris");
    expect(mobileList).toHaveTextContent("TEST-8237");
    expect(mobileList).toHaveTextContent("متاحة");
    expect(mobileList).toHaveTextContent("50,000 كم");
    expect(mobileList).toHaveTextContent("أوتوماتيك · 5 مقاعد");
    expect(mobileList).toHaveTextContent("التفاصيل");
    const metadataPanel = mobileList?.querySelector(
      "article > .grid.grid-cols-2",
    );
    expect(metadataPanel).toHaveClass("items-start");
    expect(
      within(metadataPanel as HTMLElement).getByText("العداد").parentElement,
    ).toHaveClass("self-start");
    expect(mobileList?.querySelector("article > div:last-child")).toHaveClass(
      "items-start",
    );
  });

  it("keeps short and long mixed-language identities in the same right-aligned text stack", () => {
    const longVehicle = {
      ...vehicle,
      id: "vehicle-2",
      make: "مركبة Toyota للاستخدامات التجارية الطويلة",
      model: "Land Cruiser Executive Edition",
      plateNumber: "TEST-8237-LONG-IDENTIFIER",
    } as VehicleResponse;
    const name = `${longVehicle.make} ${longVehicle.model}`;

    render(
      <VehiclesDataList vehicles={[vehicle, longVehicle]} onOpen={vi.fn()} />,
    );

    for (const identityName of screen.getAllByText(name)) {
      const identityStack = identityName.parentElement;
      const plate = identityStack?.querySelector(`[dir="ltr"]`);
      expect(identityName.classList.contains("truncate")).toBe(true);
      expect(identityStack?.classList.contains("min-w-0")).toBe(true);
      expect(identityStack?.classList.contains("text-right")).toBe(true);
      expect(plate?.classList.contains("truncate")).toBe(true);
      expect(plate?.classList.contains("text-right")).toBe(true);
    }
    expect(screen.getAllByText(longVehicle.plateNumber).length).toBeGreaterThan(
      0,
    );
  });
});
