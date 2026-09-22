import { SyncPushBody } from "@workspace/api-zod";
import { z } from "zod";

export const syncPushSchema = SyncPushBody;
export type SyncPushInput = z.infer<typeof syncPushSchema>;
export type SyncOperationInput = SyncPushInput["operations"][number];
