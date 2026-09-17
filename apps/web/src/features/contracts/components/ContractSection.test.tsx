import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApiError } from "@workspace/api-client-react";

vi.mock("@/features/contracts/hooks", () => ({
  useRentalContract: vi.fn(),
  useRentalContractSignedDocuments: vi.fn(),
}));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

import {
  useRentalContract,
  useRentalContractSignedDocuments,
} from "@/features/contracts/hooks";
import { useAuth } from "@/providers/AuthProvider";
import { ContractSection } from "./ContractSection";

const mockedUseRentalContract = vi.mocked(useRentalContract);
const mockedUseRentalContractSignedDocuments = vi.mocked(
  useRentalContractSignedDocuments,
);
const mockedUseAuth = vi.mocked(useAuth);

function missingContractError() {
  return new ApiError(
    new Response(null, { status: 404, statusText: "Not Found" }),
    { error: { code: "CONTRACT_NOT_FOUND", message: "Contract not found" } },
    { method: "GET", url: "/api/rentals/rental-1/contract" },
  );
}

function mockSignedDocuments() {
  mockedUseRentalContractSignedDocuments.mockReturnValue({
    query: { isLoading: false, isError: false, data: { data: [] } },
    upload: { isPending: false, mutateAsync: vi.fn() },
    remove: { isPending: false, mutateAsync: vi.fn() },
    download: vi.fn(),
  } as ReturnType<typeof useRentalContractSignedDocuments>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseAuth.mockReturnValue({ user: { role: "OWNER" } } as ReturnType<
    typeof useAuth
  >);
  mockedUseRentalContract.mockReturnValue({
    query: {
      isLoading: false,
      isError: true,
      error: missingContractError(),
      data: undefined,
    },
    generate: { isPending: false, mutateAsync: vi.fn() },
    remove: { isPending: false, mutateAsync: vi.fn() },
    printable: vi.fn(),
    pdf: vi.fn(),
  } as ReturnType<typeof useRentalContract>);
  mockSignedDocuments();
});

describe("ContractSection", () => {
  it("renders the no-contract state for CONTRACT_NOT_FOUND", () => {
    render(<ContractSection rentalId="rental-1" />);

    expect(screen.getByText("لا يوجد عقد لهذا الإيجار")).toBeInTheDocument();
    expect(mockedUseRentalContractSignedDocuments).toHaveBeenCalledWith(
      "rental-1",
      false,
    );
  });

  it("enables signed documents after the contract loads", () => {
    mockedUseRentalContract.mockReturnValue({
      query: {
        isLoading: false,
        isError: false,
        error: null,
        data: {
          data: {
            id: "contract-1",
            customerFirstName: "أحمد",
            customerLastName: "حسن",
            customerNationalId: "123",
            vehicleMake: "Toyota",
            vehicleModel: "Camry",
            vehiclePlateNumber: "A-1",
            pickupDate: "2026-01-01T09:00:00Z",
            expectedReturnDate: "2026-01-02T09:00:00Z",
          },
        },
      },
      generate: { isPending: false, mutateAsync: vi.fn() },
      remove: { isPending: false, mutateAsync: vi.fn() },
      printable: vi.fn(),
      pdf: vi.fn(),
    } as ReturnType<typeof useRentalContract>);

    render(<ContractSection rentalId="rental-1" />);

    expect(mockedUseRentalContractSignedDocuments).toHaveBeenCalledWith(
      "rental-1",
      true,
    );
  });
});
