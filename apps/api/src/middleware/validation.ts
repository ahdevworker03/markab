import type { Request, Response, NextFunction } from "express";
import type { ZodSchema, ZodType, ZodTypeDef } from "zod";
import { z } from "zod";
import { AppError } from "../shared";

const uuidSchema = z.string().uuid();

function validateBody<T>(schema: ZodType<T, ZodTypeDef, unknown>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.is(["application/json", "application/*+json"])) {
      next(new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Expected a JSON request body."));
      return;
    }

    const result = schema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");

      next(new AppError(422, "VALIDATION_ERROR", message));
      return;
    }

    req.body = result.data;
    next();
  };
}

function validateUuidParam(
  _req: Request,
  _res: Response,
  next: NextFunction,
  value: string,
): void {
  if (!uuidSchema.safeParse(value).success) {
    next(new AppError(422, "VALIDATION_ERROR", "Invalid UUID path parameter."));
    return;
  }

  next();
}

function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");

      next(new AppError(422, "VALIDATION_ERROR", message));
      return;
    }

    next();
  };
}

function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");

      next(new AppError(422, "VALIDATION_ERROR", message));
      return;
    }

    next();
  };
}

export { validateBody, validateQuery, validateParams, validateUuidParam };
