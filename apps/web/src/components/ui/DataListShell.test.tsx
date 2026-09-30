import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataListShell } from "./DataListShell";

describe("DataListShell", () => {
  it("makes its scroll boundary the containing block for visually hidden content", () => {
    render(
      <DataListShell title="قائمة">
        <table>
          <thead>
            <tr>
              <th>
                <span className="sr-only">فتح التفاصيل</span>
              </th>
            </tr>
          </thead>
        </table>
      </DataListShell>,
    );

    const boundary = screen.getByText("فتح التفاصيل").closest(".overflow-x-auto");
    expect(boundary).toHaveClass("relative");
  });
});
