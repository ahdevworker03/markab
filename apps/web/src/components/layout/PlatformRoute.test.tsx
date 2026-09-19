import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformRoute } from "./PlatformRoute";

const { setLocation, useAuth } = vi.hoisted(() => ({
  setLocation: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock("wouter", () => ({ useLocation: () => ["/platform", setLocation] }));
vi.mock("@/providers/AuthProvider", () => ({ useAuth }));

describe("PlatformRoute", () => {
  beforeEach(() => setLocation.mockReset());

  it("allows platform owners without mounting tenant content", () => {
    useAuth.mockReturnValue({
      user: { role: "PLATFORM_OWNER" },
      isLoading: false,
    });
    render(
      <PlatformRoute>
        <p>platform console</p>
      </PlatformRoute>,
    );
    expect(screen.getByText("platform console")).toBeInTheDocument();
  });

  it("redirects tenant users before platform content mounts", async () => {
    useAuth.mockReturnValue({ user: { role: "OWNER" }, isLoading: false });
    render(
      <PlatformRoute>
        <p>platform console</p>
      </PlatformRoute>,
    );
    await waitFor(() =>
      expect(setLocation).toHaveBeenCalledWith("/", { replace: true }),
    );
    expect(screen.queryByText("platform console")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated users to login", async () => {
    useAuth.mockReturnValue({ user: null, isLoading: false });
    render(
      <PlatformRoute>
        <p>platform console</p>
      </PlatformRoute>,
    );
    await waitFor(() =>
      expect(setLocation).toHaveBeenCalledWith("/login", { replace: true }),
    );
  });
});
