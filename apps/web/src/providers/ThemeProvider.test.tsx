import { fireEvent, render, screen } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { initializeTheme, ThemeProvider, useTheme } from "./ThemeProvider";

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>{theme}</button>;
}

function LayoutProbe({ onThemeApplied }: { onThemeApplied: (applied: boolean) => void }) {
  useLayoutEffect(() => {
    onThemeApplied(document.documentElement.classList.contains("dark"));
  }, [onThemeApplied]);

  return null;
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
  });

  it("defaults to light mode and persists a toggle", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByRole("button").textContent).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("vehicle-rental-theme")).toBe("dark");
  });

  it("restores the persisted theme", () => {
    localStorage.setItem("vehicle-rental-theme", "dark");

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByRole("button").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("initializes the persisted theme before the app renders", () => {
    localStorage.setItem("vehicle-rental-theme", "dark");
    let appliedBeforePaint = false;

    initializeTheme();

    render(
      <ThemeProvider>
        <LayoutProbe onThemeApplied={(applied) => (appliedBeforePaint = applied)} />
      </ThemeProvider>,
    );

    expect(appliedBeforePaint).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
});
