import {
  GetPlatformOrganizationParams,
  ListPlatformOrganizationsQueryParams,
  UpdateMyOrganizationBody,
  UpdateOrganizationStatusBody,
  UpdateOrganizationStatusParams,
} from "@workspace/api-zod";

export const updateOrganizationSchema = UpdateMyOrganizationBody.refine(
  (input) => Object.values(input).some((value) => value !== undefined),
  "At least one organization profile field is required.",
);
export const updateOrganizationStatusSchema = UpdateOrganizationStatusBody;
export const updateOrganizationStatusParamsSchema = UpdateOrganizationStatusParams;
export const listPlatformOrganizationsQuerySchema = ListPlatformOrganizationsQueryParams;
export const getPlatformOrganizationParamsSchema = GetPlatformOrganizationParams;

export type { UpdateOrganizationInput } from "./organization.types";
export type UpdateOrganizationStatusInput = {
  status: "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
};
export type ListPlatformOrganizationsQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: UpdateOrganizationStatusInput["status"];
};
