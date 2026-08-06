import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SegmentedControl } from "./SegmentedControl";

const OPTIONS = [
  { label: "نشطة", value: "active" },
  { label: "منتهية", value: "ended" },
  { label: "الكل", value: "all" },
];

describe("SegmentedControl keyboard navigation", () => {
  it("marks only the active tab as selected and in the tab order", () => {
    render(
      <SegmentedControl options={OPTIONS} value="ended" onChange={() => {}} />
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);

    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("tabIndex", "0");

    expect(tabs[0]).toHaveAttribute("aria-selected", "false");
    expect(tabs[0]).toHaveAttribute("tabIndex", "-1");
  });

  it("ArrowLeft moves selection forward in RTL and reports the new value", () => {
    let next = "";
    render(
      <SegmentedControl
        options={OPTIONS}
        value="active"
        onChange={(v) => (next = v)}
      />
    );
    const tabs = screen.getAllByRole("tab");
    fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    expect(next).toBe("ended");
  });

  it("ArrowRight moves selection backward in RTL", () => {
    let next = "";
    render(
      <SegmentedControl
        options={OPTIONS}
        value="ended"
        onChange={(v) => (next = v)}
      />
    );
    const tabs = screen.getAllByRole("tab");
    fireEvent.keyDown(tabs[1], { key: "ArrowRight" });
    expect(next).toBe("active");
  });

  it("Home and End jump to the first and last options", () => {
    let next = "";
    render(
      <SegmentedControl
        options={OPTIONS}
        value="active"
        onChange={(v) => (next = v)}
      />
    );
    const tabs = screen.getAllByRole("tab");
    fireEvent.keyDown(tabs[0], { key: "End" });
    expect(next).toBe("all");
    fireEvent.keyDown(tabs[0], { key: "Home" });
    expect(next).toBe("active");
  });
});
