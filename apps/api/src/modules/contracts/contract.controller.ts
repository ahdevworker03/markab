import type { Request, Response, NextFunction } from "express";
import {
  getContract,
  generateContract,
  deleteContract,
  getPrintableContract,
  exportContractPdf,
  listSignedDocuments,
  uploadSignedDocument,
  getSignedDocument,
  updateSignedDocumentExpiry,
  downloadSignedDocument,
  deleteSignedDocument,
} from "./contract.service";
import { ok, created, noContent, AppError } from "../../shared";
import { createUploadHandler } from "../media/media.upload";

const handleUpload = createUploadHandler([]);

async function get(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rentalId = req.params.id as string;
    const contract = await getContract(rentalId, req.user!.org);
    ok(res, contract);
  } catch (err) {
    next(err);
  }
}

async function generate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rentalId = req.params.id as string;
    const contract = await generateContract(rentalId, req.user!.org);
    created(res, contract);
  } catch (err) {
    next(err);
  }
}

async function remove(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rentalId = req.params.id as string;
    await deleteContract(rentalId, req.user!.org);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

async function printable(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rentalId = req.params.id as string;
    const html = await getPrintableContract(rentalId, req.user!.org);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  } catch (err) {
    next(err);
  }
}

async function pdf(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rentalId = req.params.id as string;
    const buffer = await exportContractPdf(rentalId, req.user!.org);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="contract-${rentalId}.pdf"`,
    );
    res.status(200).send(buffer);
  } catch (err) {
    next(err);
  }
}

async function listSigned(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rentalId = req.params.id as string;
    const documents = await listSignedDocuments(rentalId, req.user!.org);
    ok(res, documents);
  } catch (err) {
    next(err);
  }
}

async function uploadSigned(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rentalId = req.params.id as string;
    const file = req.file;

    if (!file) {
      throw new AppError(422, "FILE_REQUIRED", "A file is required.");
    }

    const document = await uploadSignedDocument(rentalId, req.user!.org, file);
    created(res, document);
  } catch (err) {
    next(err);
  }
}

async function getSigned(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rentalId = req.params.id as string;
    const documentId = req.params.documentId as string;
    const document = await getSignedDocument(
      rentalId,
      req.user!.org,
      documentId,
    );
    ok(res, document);
  } catch (err) {
    next(err);
  }
}

async function updateSigned(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const document = await updateSignedDocumentExpiry(
      req.params.id as string,
      req.user!.org,
      req.params.documentId as string,
      req.body.expiryDate,
    );
    ok(res, document);
  } catch (err) {
    next(err);
  }
}

function sendFile(
  res: Response,
  result: Awaited<ReturnType<typeof downloadSignedDocument>>,
): void {
  res.setHeader("Content-Type", result.mimeType);
  res.setHeader("Content-Length", String(result.size));
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${result.filename.replace(/["\\]/g, "")}"`,
  );
  res.status(200).send(result.buffer);
}

async function downloadSigned(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rentalId = req.params.id as string;
    const documentId = req.params.documentId as string;
    const result = await downloadSignedDocument(
      rentalId,
      req.user!.org,
      documentId,
    );
    sendFile(res, result);
  } catch (err) {
    next(err);
  }
}

async function deleteSigned(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rentalId = req.params.id as string;
    const documentId = req.params.documentId as string;
    await deleteSignedDocument(rentalId, req.user!.org, documentId);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

export {
  handleUpload,
  get,
  generate,
  remove,
  printable,
  pdf,
  listSigned,
  uploadSigned,
  getSigned,
  updateSigned,
  downloadSigned,
  deleteSigned,
};
