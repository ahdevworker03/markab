import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge status mapping", () => {
  it("renders the Arabic label for each status", () => {
    render(
      <>
        <StatusBadge status="available" />
        <StatusBadge status="rented" />
        <StatusBadge status="maintenance" />
        <StatusBadge status="upcoming" />
        <StatusBadge status="overdue" />
      </>
    );
    expect(screen.getByText("متاحة")).toBeInTheDocument();
    expect(screen.getByText("مؤجرة")).toBeInTheDocument();
    expect(screen.getByText("صيانة")).toBeInTheDocument();
    expect(screen.getByText("قادمة")).toBeInTheDocument();
    expect(screen.getByText("متأخرة")).toBeInTheDocument();
  });

  it("styles upcoming with the maintenance (amber) token, not the rented (blue) token", () => {
    render(<StatusBadge status="upcoming" />);
    const badge = screen.getByText("قادمة");
    expect(badge.className).toContain("status-maintenance-bg");
    expect(badge.className).not.toContain("status-rented-bg");
  });
});
