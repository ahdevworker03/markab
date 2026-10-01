import {
  LoginBody,
  RequestPasswordResetBody,
  ConfirmPasswordResetBody,
} from "@workspace/api-zod";
import { z } from "zod";
import { normalizeEmailInput } from "./email";

export const loginSchema = z.preprocess(normalizeEmailInput, LoginBody);
export const requestPasswordResetSchema = z.preprocess(
  normalizeEmailInput,
  RequestPasswordResetBody,
);
export const confirmPasswordResetSchema = ConfirmPasswordResetBody;

export type LoginInput = {
  email: string;
  password: string;
};

export type RequestPasswordResetInput = { email: string };

export type ConfirmPasswordResetInput = {
  token: string;
  password: string;
};
