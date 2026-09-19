-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "internal_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_internal_key_key" ON "Organization"("internal_key");
