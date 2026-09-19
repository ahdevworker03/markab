export type AuditAction =
  | "ORGANIZATION_STATUS_UPDATED"
  | "PLATFORM_OWNER_BOOTSTRAPPED"
  | "EMPLOYEE_INVITATION_CREATED"
  | "EMPLOYEE_INVITATION_RESENT"
  | "EMPLOYEE_INVITATION_ACCEPTED"
  | "PASSWORD_RESET_COMPLETED"
  | "USER_CREATED"
  | "USER_DELETED";

export type AuditTargetType = "ORGANIZATION" | "EMPLOYEE_INVITATION" | "USER";

export type AuditMetadata = Record<string, string | number | boolean | null>;

export interface CreateAuditLogInput {
  organizationId?: string;
  actorUserId?: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string;
  metadata?: AuditMetadata;
}
