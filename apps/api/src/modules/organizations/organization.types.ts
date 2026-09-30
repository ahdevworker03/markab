export type OrganizationStatus =
  | "TRIAL"
  | "ACTIVE"
  | "SUSPENDED"
  | "CANCELLED";

export interface OrganizationRecord {
  id: string;
  name: string;
  status: OrganizationStatus;
  legal_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  contract_footer_text: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface OrganizationResponse {
  id: string;
  name: string;
  status: OrganizationStatus;
  legalName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  contractFooterText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformOrganizationResponse {
  id: string;
  name: string;
  status: OrganizationStatus;
  legalName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  legalName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  contractFooterText?: string | null;
}

export interface PlatformOrganizationUserResponse {
  id: string;
  email: string;
  role: "OWNER" | "EMPLOYEE";
  status: "ACTIVE" | "DEACTIVATED";
  createdAt: string;
  deactivatedAt: string | null;
}

export interface PlatformOrganizationInvitationResponse {
  id: string;
  email: string;
  status: "PENDING" | "EXPIRED" | "ACCEPTED";
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

export interface PlatformOrganizationUsersResponse {
  users: PlatformOrganizationUserResponse[];
  invitations: PlatformOrganizationInvitationResponse[];
}
