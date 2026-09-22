import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../../shared";

const resourceTypes = ["CUSTOMER", "VEHICLE", "RENTAL"] as const;

export type SyncResourceType = (typeof resourceTypes)[number];

export interface SyncPosition {
  updatedAt: Date;
  resourceType: SyncResourceType;
  id: string;
}

export interface PullCursor {
  after: SyncPosition;
  upper?: SyncPosition;
  completed: boolean;
}

interface CursorPayload {
  v: 2;
  a: [string, SyncResourceType, string];
  u?: [string, SyncResourceType, string];
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

function isSyncResourceType(value: unknown): value is SyncResourceType {
  return typeof value === "string" && resourceTypes.includes(value as SyncResourceType);
}

function resourceTypeRank(resourceType: SyncResourceType): number {
  return resourceTypes.indexOf(resourceType);
}

function comparePositions(left: SyncPosition, right: SyncPosition): number {
  const byTimestamp = left.updatedAt.getTime() - right.updatedAt.getTime();
  if (byTimestamp) return byTimestamp;
  const byResourceType = resourceTypeRank(left.resourceType) - resourceTypeRank(right.resourceType);
  return byResourceType || left.id.localeCompare(right.id);
}

function toPosition(value: unknown): SyncPosition {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    typeof value[0] !== "string" ||
    !isSyncResourceType(value[1]) ||
    typeof value[2] !== "string"
  ) {
    throw cursorError();
  }
  const updatedAt = new Date(value[0]);
  if (Number.isNaN(updatedAt.getTime())) throw cursorError();
  return { updatedAt, resourceType: value[1], id: value[2] };
}

function serializePosition(
  position: SyncPosition,
): [string, SyncResourceType, string] {
  return [position.updatedAt.toISOString(), position.resourceType, position.id];
}

function encodeCursor(
  organizationId: string,
  after: SyncPosition,
  upper?: SyncPosition,
): string {
  const payload: CursorPayload = {
    v: 2,
    a: serializePosition(after),
    ...(upper
      ? { u: serializePosition(upper) }
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

  if (!payload || payload.v !== 2) throw cursorError();
  const after = toPosition(payload.a);
  if (payload.c === true && !payload.u) return { after, completed: true };
  if (payload.c || !payload.u) throw cursorError();
  return { after, upper: toPosition(payload.u), completed: false };
}

export {
  comparePositions,
  decodeCursor,
  encodeCursor,
  resourceTypeRank,
};
