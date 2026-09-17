import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";

vi.mock("@workspace/api-client-react", () => ({
  useGetRentalContract: vi.fn(),
  useGenerateRentalContract: vi.fn(),
  useDeleteRentalContract: vi.fn(),
  useListRentalContractSignedDocuments: vi.fn(),
  useUploadRentalContractSignedDocument: vi.fn(),
  useDeleteRentalContractSignedDocument: vi.fn(),
  getGetRentalContractQueryKey: vi.fn(() => []),
  getListRentalContractSignedDocumentsQueryKey: vi.fn(() => []),
  getRentalContractPrintable: vi.fn(),
  getRentalContractPdf: vi.fn(),
  downloadRentalContractSignedDocument: vi.fn(),
}));

import {
  useDeleteRentalContract,
  useDeleteRentalContractSignedDocument,
  useGenerateRentalContract,
  useGetRentalContract,
  useListRentalContractSignedDocuments,
  useUploadRentalContractSignedDocument,
} from "@workspace/api-client-react";
import {
  useRentalContract,
  useRentalContractSignedDocuments,
} from "./hooks";

const mockedUseGetRentalContract = vi.mocked(useGetRentalContract);
const mockedUseListRentalContractSignedDocuments = vi.mocked(
  useListRentalContractSignedDocuments,
);

function wrapper({ children }: PropsWithChildren) {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseGetRentalContract.mockReturnValue({} as ReturnType<
    typeof useGetRentalContract
  >);
  mockedUseListRentalContractSignedDocuments.mockReturnValue({} as ReturnType<
    typeof useListRentalContractSignedDocuments
  >);
  vi.mocked(useGenerateRentalContract).mockReturnValue({} as ReturnType<
    typeof useGenerateRentalContract
  >);
  vi.mocked(useDeleteRentalContract).mockReturnValue({} as ReturnType<
    typeof useDeleteRentalContract
  >);
  vi.mocked(useUploadRentalContractSignedDocument).mockReturnValue({} as ReturnType<
    typeof useUploadRentalContractSignedDocument
  >);
  vi.mocked(useDeleteRentalContractSignedDocument).mockReturnValue({} as ReturnType<
    typeof useDeleteRentalContractSignedDocument
  >);
});

describe("contract query hooks", () => {
  it("disables retries for the contract lookup", () => {
    renderHook(() => useRentalContract("rental-1"), { wrapper });

    expect(mockedUseGetRentalContract).toHaveBeenCalledWith("rental-1", {
      query: expect.objectContaining({ retry: false }),
    });
  });

  it("keeps signed documents disabled until the contract exists", () => {
    const { rerender } = renderHook(
      ({ enabled }) => useRentalContractSignedDocuments("rental-1", enabled),
      { initialProps: { enabled: false }, wrapper },
    );

    expect(mockedUseListRentalContractSignedDocuments).toHaveBeenLastCalledWith(
      "rental-1",
      { query: expect.objectContaining({ enabled: false }) },
    );

    rerender({ enabled: true });

    expect(mockedUseListRentalContractSignedDocuments).toHaveBeenLastCalledWith(
      "rental-1",
      { query: expect.objectContaining({ enabled: true }) },
    );
  });
});
