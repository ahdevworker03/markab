import {
  RegisterOrganizationBody,
  LoginBody,
  RefreshTokenBody,
  LogoutBody,
  RequestPasswordResetBody,
  ConfirmPasswordResetBody,
} from "@workspace/api-zod";
import { z } from "zod";
import { normalizeEmailInput } from "./email";

export const registerSchema = z.preprocess(
  normalizeEmailInput,
  RegisterOrganizationBody,
);
export const loginSchema = z.preprocess(normalizeEmailInput, LoginBody);
export const refreshSchema = RefreshTokenBody;
export const logoutSchema = LogoutBody;
export const requestPasswordResetSchema = z.preprocess(
  normalizeEmailInput,
  RequestPasswordResetBody,
);
export const confirmPasswordResetSchema = ConfirmPasswordResetBody;

export type RegisterInput = {
  email: string;
  password: string;
  organizationName: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RefreshInput = {
  refreshToken: string;
};

export type LogoutInput = {
  refreshToken: string;
};

export type RequestPasswordResetInput = { email: string };

export type ConfirmPasswordResetInput = {
  token: string;
  password: string;
};
