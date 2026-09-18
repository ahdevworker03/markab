import { CreateUserBody, UpdateUserBody } from "@workspace/api-zod";
import { z } from "zod";
import { normalizeEmailInput } from "../auth/email";

export const createUserSchema = z.preprocess(
  normalizeEmailInput,
  CreateUserBody,
);
export const updateUserSchema = UpdateUserBody;

export type CreateUserInput = {
  email: string;
  password: string;
  role: "EMPLOYEE";
};

export type UpdateUserInput = {
  role: "EMPLOYEE";
};
