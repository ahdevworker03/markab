import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationStatusGate } from "./OrganizationStatusGate";

const { useGetMyOrganization } = vi.hoisted(() => ({
  useGetMyOrganization: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({ useGetMyOrganization }));
vi.mock("./LogoutButton", () => ({
  LogoutButton: () => <button type="button">تسجيل الخروج</button>,
}));

describe("OrganizationStatusGate", () => {
  beforeEach(() => {
    useGetMyOrganization.mockReset();
  });

  it("keeps active organizations in the application", () => {
    useGetMyOrganization.mockReturnValue({
      data: { data: { status: "ACTIVE" } },
    });

    render(
      <OrganizationStatusGate>
        <p>محتوى التطبيق</p>
      </OrganizationStatusGate>,
    );

    expect(screen.getByText("محتوى التطبيق")).toBeInTheDocument();
  });

  it("blocks operations for suspended organizations and keeps logout available", () => {
    useGetMyOrganization.mockReturnValue({
      data: { data: { status: "SUSPENDED" } },
    });

    render(
      <OrganizationStatusGate>
        <p>محتوى التطبيق</p>
      </OrganizationStatusGate>,
    );

    expect(
      screen.getByRole("heading", { name: "تم تعليق حساب المؤسسة" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("محتوى التطبيق")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "تسجيل الخروج" }),
    ).toBeInTheDocument();
  });

  it("blocks operations for cancelled organizations and keeps logout available", () => {
    useGetMyOrganization.mockReturnValue({
      data: { data: { status: "CANCELLED" } },
    });

    render(
      <OrganizationStatusGate>
        <p>محتوى التطبيق</p>
      </OrganizationStatusGate>,
    );

    expect(
      screen.getByRole("heading", { name: "تم إلغاء حساب المؤسسة" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("محتوى التطبيق")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "تسجيل الخروج" }),
    ).toBeInTheDocument();
  });

  it("does not mount tenant operations until an active organization is verified", () => {
    useGetMyOrganization.mockReturnValue({ isPending: true });

    render(
      <OrganizationStatusGate>
        <p>محتوى التطبيق</p>
      </OrganizationStatusGate>,
    );

    expect(screen.queryByText("محتوى التطبيق")).not.toBeInTheDocument();
  });

  it("does not mount tenant operations when organization status is unavailable", () => {
    useGetMyOrganization.mockReturnValue({ isError: true });

    render(
      <OrganizationStatusGate>
        <p>محتوى التطبيق</p>
      </OrganizationStatusGate>,
    );

    expect(screen.queryByText("محتوى التطبيق")).not.toBeInTheDocument();
  });
});
