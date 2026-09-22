import { SyncPullQueryParams, SyncPushBody } from "@workspace/api-zod";
import { z } from "zod";

export const syncPushSchema = SyncPushBody;
export const syncPullQuerySchema = SyncPullQueryParams;
export type SyncPushInput = z.infer<typeof syncPushSchema>;
export type SyncOperationInput = SyncPushInput["operations"][number];
export type SyncPullQuery = z.infer<typeof syncPullQuerySchema>;
