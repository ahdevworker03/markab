import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CustomerResponse } from "@workspace/api-client-react";
import { CustomersDataList } from "./CustomersDataList";

const customer = {
  id: "customer-1",
  firstName: "أحمد",
  lastName: "حسن",
  phone: "+9613012345",
  address: "بيروت",
  nationalId: "123456789",
  licenseNumber: "DL-9988",
  licenseExpiryDate: "2027-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as CustomerResponse;

describe("CustomersDataList", () => {
  it("shows the customer name, phone, and address without identity or license values", () => {
    render(<CustomersDataList customers={[customer]} onOpen={vi.fn()} />);

    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("columnheader", { name: "العميل" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "رقم الهاتف" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "الموقع" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "الإجراء" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("أحمد حسن").length).toBeGreaterThan(0);
    expect(screen.getAllByText(customer.phone).length).toBeGreaterThan(0);
    expect(screen.getAllByText(customer.address).length).toBeGreaterThan(0);
    expect(screen.queryByText(customer.nationalId)).toBeNull();
    expect(screen.queryByText(customer.licenseNumber)).toBeNull();
  });

  it("keeps long customer names and locations contained with an LTR phone", () => {
    const longCustomer = {
      ...customer,
      id: "customer-2",
      firstName: "شركة النخبة الدولية لتأجير المركبات",
      lastName: "Al Noor Fleet Management",
      phone: "+٩٦١۷۰۱۲۳۴۵۶۷۸۹۰",
      address: "شارع الحمرا، بيروت — Building 24, Floor 7, Near Main Square",
      nationalId: "12345678901234567890",
      licenseNumber: "LB-DRIVER-LICENSE-2026-998877",
    };
    render(<CustomersDataList customers={[longCustomer]} onOpen={vi.fn()} />);

    const names = screen.getAllByText(
      "شركة النخبة الدولية لتأجير المركبات Al Noor Fleet Management",
    );
    expect(names[0]).toHaveClass("break-words", "text-sm", "font-medium");

    expect(screen.queryByText(longCustomer.nationalId)).toBeNull();
    expect(screen.queryByText(longCustomer.licenseNumber)).toBeNull();

    const mobileCard = screen
      .getAllByText("الهاتف")
      .at(-1)!
      .closest("article")!;
    const mobileFields = mobileCard.querySelector(".grid")!;
    expect(mobileFields).toHaveClass("grid-cols-2", "min-w-0");
    const mobileName = within(mobileCard).getByText(
      "شركة النخبة الدولية لتأجير المركبات Al Noor Fleet Management",
    );
    expect(mobileName).toHaveClass("break-words");
    expect(within(mobileCard).getByText("الهاتف").parentElement).toHaveClass(
      "min-w-0",
    );
    const mobilePhone = within(mobileCard).getByText("+961701234567890");
    expect(mobilePhone).toHaveAttribute("dir", "ltr");
    expect(mobilePhone).toHaveClass("number-ltr", "text-right");
    expect(within(mobileCard).getByText("الموقع").parentElement).toHaveClass(
      "min-w-0",
    );
    const mobileLocation = within(mobileCard).getByText(longCustomer.address);
    expect(mobileLocation).toHaveAttribute("dir", "auto");
    expect(mobileLocation).toHaveClass("min-w-0", "break-words", "text-start");
  });

  it("preserves desktop customer table widths and actions", () => {
    render(<CustomersDataList customers={[customer]} onOpen={vi.fn()} />);

    const table = screen.getByRole("table");
    expect(table).toHaveClass("min-w-[62rem]", "table-fixed");
    expect(
      within(table).getByRole("columnheader", { name: "العميل" }),
    ).toHaveClass("w-[20rem]");
    expect(
      within(table).getByRole("columnheader", { name: "رقم الهاتف" }),
    ).toHaveClass("w-[10rem]", "text-start");
    expect(
      within(table).getByRole("columnheader", { name: "الموقع" }),
    ).toHaveClass("w-[20rem]", "text-start");
    expect(
      within(table).getByRole("columnheader", { name: "الإجراء" }),
    ).toHaveClass("w-[10rem]");
  });

  it("opens the selected customer", () => {
    const onOpen = vi.fn();
    render(<CustomersDataList customers={[customer]} onOpen={onOpen} />);

    fireEvent.click(screen.getAllByRole("button", { name: "عرض التفاصيل" })[0]);
    expect(onOpen).toHaveBeenCalledWith("customer-1");
  });
});
