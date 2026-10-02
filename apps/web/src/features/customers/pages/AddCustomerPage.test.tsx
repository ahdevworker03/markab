import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@workspace/api-client-react";
import AddCustomerPage from "./AddCustomerPage";

const { setLocation, useCustomerMutations, useOffline, queueCustomerCreate } = vi.hoisted(() => ({
  setLocation: vi.fn(),
  useCustomerMutations: vi.fn(),
  useOffline: vi.fn(),
  queueCustomerCreate: vi.fn().mockResolvedValue("customer-create"),
}));

const create = {
  isPending: false,
  mutateAsync: vi.fn(),
};

vi.mock("wouter", () => ({
  useLocation: () => ["/customers/add", setLocation],
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useUploadCustomerDocument: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock("@/features/customers/api-hooks", () => ({ useCustomerMutations }));
vi.mock("@/features/offline/OfflineProvider", () => ({ useOffline }));
vi.mock("@/features/offline/commands", () => ({
  createOfflineCommands: () => ({ queueCustomerCreate }),
}));
vi.mock("@/features/customers/components/CustomerFormFields", () => ({
  CustomerFormFields: ({ onChange }: { onChange: (field: string, value: string) => void }) => (
    <button
      type="button"
      onClick={() => {
        onChange("first_name", "أحمد");
        onChange("last_name", "حسن");
        onChange("phone", "03000000");
        onChange("address", "بيروت");
        onChange("national_id", "NID-1");
        onChange("license_number", "LIC-1");
        onChange("license_expiry_date", "2027-01-01");
      }}
    >
      املأ النموذج
    </button>
  ),
}));

function apiError(status: number) {
  return new ApiError(
    new Response(JSON.stringify({ error: { code: "VALIDATION_ERROR" } }), {
      status,
      statusText: "Request failed",
    }),
    { error: { code: "VALIDATION_ERROR" } },
    { method: "POST", url: "https://api.example.test/customers" },
  );
}

describe("AddCustomerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    create.mutateAsync.mockResolvedValue({ data: { id: "customer-1" } });
    useCustomerMutations.mockReturnValue({ create });
    useOffline.mockReturnValue({
      isOffline: false,
      workspace: { organizationId: "organization-1", userId: "user-1" },
      store: {},
      refreshProjections: vi.fn(),
      markOffline: vi.fn(),
    });
  });

  async function submitValidCustomer() {
    fireEvent.click(screen.getByRole("button", { name: "املأ النموذج" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ العميل" }));
  }

  it("queues a create after an unreachable request even when navigator reports online", async () => {
    create.mutateAsync.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<AddCustomerPage />);

    await submitValidCustomer();

    await waitFor(() =>
      expect(queueCustomerCreate).toHaveBeenCalledWith({
        first_name: "أحمد",
        last_name: "حسن",
        phone: "03000000",
        address: "بيروت",
        national_id: "NID-1",
        license_number: "LIC-1",
        license_expiry_date: "2027-01-01T00:00:00.000Z",
      }),
    );
    expect(setLocation).toHaveBeenCalledWith("/customers");
  });

  it("keeps the existing explicit offline queue behavior", async () => {
    useOffline.mockReturnValue({
      isOffline: true,
      workspace: { organizationId: "organization-1", userId: "user-1" },
      store: {},
      refreshProjections: vi.fn(),
      markOffline: vi.fn(),
    });
    render(<AddCustomerPage />);

    await submitValidCustomer();

    await waitFor(() => expect(queueCustomerCreate).toHaveBeenCalledOnce());
    expect(create.mutateAsync).not.toHaveBeenCalled();
  });

  it("does not queue a validation response", async () => {
    create.mutateAsync.mockRejectedValueOnce(apiError(422));
    render(<AddCustomerPage />);

    await submitValidCustomer();

    await waitFor(() => expect(screen.getByText("تحقق من البيانات المدخلة ثم حاول مرة أخرى.")).toBeInTheDocument());
    expect(queueCustomerCreate).not.toHaveBeenCalled();
    expect(setLocation).not.toHaveBeenCalled();
  });

  it("preserves the successful online create flow", async () => {
    render(<AddCustomerPage />);

    await submitValidCustomer();

    await waitFor(() => expect(setLocation).toHaveBeenCalledWith("/customers/customer-1"));
    expect(create.mutateAsync).toHaveBeenCalledOnce();
    expect(queueCustomerCreate).not.toHaveBeenCalled();
  });
});
