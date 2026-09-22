-- CreateEnum
CREATE TYPE "SyncOperationType" AS ENUM ('CUSTOMER_CREATE', 'CUSTOMER_UPDATE', 'RENTAL_CREATE');

-- CreateEnum
CREATE TYPE "SyncOperationOutcome" AS ENUM ('APPLIED', 'CONFLICT', 'REJECTED');

-- CreateEnum
CREATE TYPE "SyncResourceType" AS ENUM ('CUSTOMER', 'RENTAL');

-- CreateTable
CREATE TABLE "SyncOperationReceipt" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "request_fingerprint" TEXT NOT NULL,
    "operation_type" "SyncOperationType" NOT NULL,
    "outcome" "SyncOperationOutcome" NOT NULL,
    "resource_type" "SyncResourceType",
    "resource_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncOperationReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncOperationReceipt_expires_at_idx" ON "SyncOperationReceipt"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "SyncOperationReceipt_organization_id_operation_id_key" ON "SyncOperationReceipt"("organization_id", "operation_id");

-- AddForeignKey
ALTER TABLE "SyncOperationReceipt" ADD CONSTRAINT "SyncOperationReceipt_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
