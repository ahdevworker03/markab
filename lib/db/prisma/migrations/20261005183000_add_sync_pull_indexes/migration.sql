-- CreateIndex
CREATE INDEX "Customer_organization_id_updated_at_id_idx" ON "Customer"("organization_id", "updated_at", "id");

-- CreateIndex
CREATE INDEX "Vehicle_organization_id_updated_at_id_idx" ON "Vehicle"("organization_id", "updated_at", "id");

-- CreateIndex
CREATE INDEX "Rental_organization_id_updated_at_id_idx" ON "Rental"("organization_id", "updated_at", "id");
