import { z } from "zod";
import { AppError } from "../../shared";

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB in bytes

export const PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export function isPhotoMimeType(mimeType: string): boolean {
  return (PHOTO_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function isDocumentMimeType(mimeType: string): boolean {
  return (DOCUMENT_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function assertFileMatchesMimeType(
  mimeType: string,
  buffer: Buffer,
): void {
  if (buffer.length === 0) {
    throw new AppError(422, "EMPTY_FILE", "Uploaded file is empty.");
  }

  const signatureMatches =
    (mimeType === "application/pdf" &&
      buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) ||
    (mimeType === "image/jpeg" &&
      buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) ||
    (mimeType === "image/png" &&
      buffer
        .subarray(0, 8)
        .equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        )) ||
    (mimeType === "image/webp" &&
      buffer.subarray(0, 4).equals(Buffer.from("RIFF")) &&
      buffer.subarray(8, 12).equals(Buffer.from("WEBP")));

  if (!signatureMatches) {
    throw new AppError(
      422,
      "INVALID_FILE_SIGNATURE",
      "Uploaded file signature does not match its declared type.",
    );
  }
}

export function extensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return "bin";
  }
}

export const createPhotoSchema = z.object({
  caption: z.string().optional(),
  sort_order: z.string().optional(),
});

export const createDocumentSchema = z.object({
  category: z.enum(["REGISTRATION", "INSURANCE", "OTHER"], {
    errorMap: () => ({
      message: "Category must be REGISTRATION, INSURANCE, or OTHER",
    }),
  }),
});

const minimumDocumentExpiryDate = new Date("1900-01-01T00:00:00.000Z");
const maximumDocumentExpiryDate = new Date("2100-12-31T00:00:00.000Z");

export const documentMetadataSchema = z.object({
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date must be YYYY-MM-DD.")
    .nullable(),
});

export function parseDocumentExpiryDate(value: unknown): Date | null {
  if (value === undefined || value === "" || value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(
      422,
      "VALIDATION_ERROR",
      "expiryDate: Expiry date must be YYYY-MM-DD.",
    );
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    date < minimumDocumentExpiryDate ||
    date > maximumDocumentExpiryDate
  ) {
    throw new AppError(
      422,
      "VALIDATION_ERROR",
      "expiryDate: Expiry date must be between 1900-01-01 and 2100-12-31.",
    );
  }
  return date;
}

export type CreatePhotoInput = z.infer<typeof createPhotoSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
