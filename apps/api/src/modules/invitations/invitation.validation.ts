import {
  AcceptEmployeeInvitationBody,
  CreateEmployeeInvitationBody,
} from "@workspace/api-zod";
import { z } from "zod";
import { normalizeEmailInput } from "../auth/email";

export const createEmployeeInvitationSchema = z.preprocess(
  normalizeEmailInput,
  CreateEmployeeInvitationBody,
);

export const acceptEmployeeInvitationSchema = AcceptEmployeeInvitationBody;
