import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../../shared";

export interface SyncPosition {
  updatedAt: Date;
  id: string;
}

export interface PullCursor {
  after: SyncPosition;
  upper?: SyncPosition;
  completed: boolean;
}

interface CursorPayload {
  v: 1;
  a: [string, string];
  u?: [string, string];
  c?: true;
}

function cursorError(): AppError {
  return new AppError(422, "SYNC_CURSOR_INVALID", "Invalid sync cursor.");
}

function secret(): string {
  const value = process.env["JWT_SECRET"];
  if (!value) throw new AppError(500, "SYNC_CURSOR_SECRET_MISSING", "Sync cursor secret is unavailable.");
  return value;
}

function signature(encoded: string, organizationId: string): string {
  return createHmac("sha256", secret())
    .update(`${organizationId}.${encoded}`)
    .digest("base64url");
}

function toPosition(value: unknown): SyncPosition {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    typeof value[0] !== "string" ||
    typeof value[1] !== "string"
  ) {
    throw cursorError();
  }
  const updatedAt = new Date(value[0]);
  if (Number.isNaN(updatedAt.getTime())) throw cursorError();
  return { updatedAt, id: value[1] };
}

function encodeCursor(
  organizationId: string,
  after: SyncPosition,
  upper?: SyncPosition,
): string {
  const payload: CursorPayload = {
    v: 1,
    a: [after.updatedAt.toISOString(), after.id],
    ...(upper
      ? { u: [upper.updatedAt.toISOString(), upper.id] as [string, string] }
      : { c: true as const }),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded, organizationId)}`;
}

function decodeCursor(organizationId: string, cursor: string): PullCursor {
  const [encoded, providedSignature, ...extra] = cursor.split(".");
  if (!encoded || !providedSignature || extra.length > 0) throw cursorError();

  const expectedSignature = signature(encoded, organizationId);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw cursorError();
  }

  let payload: CursorPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw cursorError();
  }

  if (!payload || payload.v !== 1) throw cursorError();
  const after = toPosition(payload.a);
  if (payload.c === true && !payload.u) return { after, completed: true };
  if (payload.c || !payload.u) throw cursorError();
  return { after, upper: toPosition(payload.u), completed: false };
}

export { decodeCursor, encodeCursor };
