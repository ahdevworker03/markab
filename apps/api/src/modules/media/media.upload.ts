import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError } from "../../shared";
import { MAX_FILE_SIZE } from "./media.validation";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

export function createUploadHandler(allowedFields: readonly string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          next(
            new AppError(
              422,
              "FILE_TOO_LARGE",
              "File exceeds the 10 MB size limit.",
            ),
          );
          return;
        }

        next(new AppError(422, "UPLOAD_ERROR", "Invalid multipart upload."));
        return;
      }

      if (err) {
        next(new AppError(422, "UPLOAD_ERROR", "Invalid multipart upload."));
        return;
      }

      if (
        Object.keys(req.body).some((field) => !allowedFields.includes(field))
      ) {
        next(new AppError(422, "UPLOAD_ERROR", "Unexpected multipart field."));
        return;
      }

      next();
    });
  };
}
