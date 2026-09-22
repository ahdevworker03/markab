import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function apiError(code: string, message: string, status = 409) {
  return new ApiError(
    new Response(null, { status, statusText: "Error" }),
    { error: { code, message } },
    { method: "POST", url: "/api/rentals/rental-1/contract" },
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

function mockLoadedContract() {
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

  it("shows the localized lifecycle error when contract generation is rejected", async () => {
    mockedUseRentalContract.mockReturnValue({
      query: {
        isLoading: false,
        isError: true,
        error: missingContractError(),
        data: undefined,
      },
      generate: {
        isPending: false,
        mutateAsync: vi
          .fn()
          .mockRejectedValue(
            apiError(
              "INVALID_RENTAL_STATE",
              "Contract can only be generated for a reserved or active rental.",
            ),
          ),
      },
      remove: { isPending: false, mutateAsync: vi.fn() },
      printable: vi.fn(),
      pdf: vi.fn(),
    } as ReturnType<typeof useRentalContract>);

    render(<ContractSection rentalId="rental-1" />);
    fireEvent.click(screen.getByRole("button", { name: "إنشاء العقد" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "لا يمكن إنشاء العقد إلا للإيجار المحجوز أو النشط.",
    );
  });

  it("shows the shared size-limit feedback without uploading an oversized file", async () => {
    const upload = vi.fn();
    mockLoadedContract();
    mockSignedDocuments();
    mockedUseRentalContractSignedDocuments.mockReturnValue({
      query: { isLoading: false, isError: false, data: { data: [] } },
      upload: { isPending: false, mutateAsync: upload },
      remove: { isPending: false, mutateAsync: vi.fn() },
      download: vi.fn(),
    } as ReturnType<typeof useRentalContractSignedDocuments>);

    const { container } = render(<ContractSection rentalId="rental-1" />);
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');

    fireEvent.change(input!, {
      target: {
        files: [
          new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "حجم الملف يتجاوز الحد الأقصى المسموح به وهو 10 ميغابايت.",
    );
    expect(upload).not.toHaveBeenCalled();
  });

  it("keeps successful contract generation feedback", async () => {
    const generate = vi.fn().mockResolvedValue({});
    mockedUseRentalContract.mockReturnValue({
      query: {
        isLoading: false,
        isError: true,
        error: missingContractError(),
        data: undefined,
      },
      generate: { isPending: false, mutateAsync: generate },
      remove: { isPending: false, mutateAsync: vi.fn() },
      printable: vi.fn(),
      pdf: vi.fn(),
    } as ReturnType<typeof useRentalContract>);

    render(<ContractSection rentalId="rental-1" />);
    fireEvent.click(screen.getByRole("button", { name: "إنشاء العقد" }));

    expect(await screen.findByText("تم إنشاء العقد بنجاح")).toBeInTheDocument();
  });

  it("keeps successful signed-contract uploads", async () => {
    const upload = vi.fn().mockResolvedValue({});
    mockLoadedContract();
    mockedUseRentalContractSignedDocuments.mockReturnValue({
      query: { isLoading: false, isError: false, data: { data: [] } },
      upload: { isPending: false, mutateAsync: upload },
      remove: { isPending: false, mutateAsync: vi.fn() },
      download: vi.fn(),
    } as ReturnType<typeof useRentalContractSignedDocuments>);

    const { container } = render(<ContractSection rentalId="rental-1" />);
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');

    fireEvent.change(input!, {
      target: {
        files: [new File(["pdf"], "contract.pdf", { type: "application/pdf" })],
      },
    });

    await waitFor(() => {
      expect(upload).toHaveBeenCalled();
    });
    expect(
      await screen.findByText("تم رفع العقد الموقّع بنجاح"),
    ).toBeInTheDocument();
  });
});
