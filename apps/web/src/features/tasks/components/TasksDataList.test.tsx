import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskResponse } from "@workspace/api-client-react";
import { TasksDataList } from "./TasksDataList";

const task = {
  id: "task-12345678-90ab-cdef-1234-567890abcdef",
  title: "تجديد تأمين السيارة",
  dueDate: "2026-11-04T00:00:00.000Z",
  status: "COMPLETED",
  recurrenceInterval: null,
  recurrenceUnit: null,
  recurrenceEndDate: null,
  recurrenceEndCount: null,
  occurrenceNumber: 1,
  predecessorId: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
} as TaskResponse;

describe("TasksDataList mobile cards", () => {
  it("keeps the due date compact and groups completion state with the details action", () => {
    const onOpen = vi.fn();
    const { container } = render(
      <TasksDataList tasks={[task]} onOpen={onOpen} />,
    );

    const mobileList = container.querySelector('[class~="md:hidden"]')!;
    const mobileCard = mobileList.querySelector("article")!;
    const card = within(mobileCard);
    const duePanel = mobileCard.querySelector(".rounded-lg")!;
    const footer = mobileCard.lastElementChild!;
    const dueDate = duePanel.querySelector('[dir="ltr"]')!;

    expect(mobileCard).toHaveClass("space-y-3", "px-4", "py-3");
    expect(card.getByText(task.title)).toBeInTheDocument();
    expect(card.getByText("مكتملة")).toBeInTheDocument();
    expect(duePanel).toHaveClass("px-3", "py-2");
    expect(duePanel).toContainElement(card.getByText("تاريخ الاستحقاق"));
    expect(dueDate).toHaveClass("number-ltr");
    expect(footer).toContainElement(card.getByText("مهمة مكتملة"));
    expect(footer).toContainElement(card.getByRole("button", { name: "التفاصيل" }));

    fireEvent.click(card.getByRole("button", { name: "التفاصيل" }));
    expect(onOpen).toHaveBeenCalledWith(task.id);
  });
});
