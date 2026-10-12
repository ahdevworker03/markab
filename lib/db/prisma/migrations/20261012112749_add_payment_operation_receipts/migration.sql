-- CreateTable
CREATE TABLE "PaymentOperationReceipt" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "request_fingerprint" TEXT NOT NULL,
    "payment_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentOperationReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOperationReceipt_payment_id_key" ON "PaymentOperationReceipt"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOperationReceipt_organization_id_operation_id_key" ON "PaymentOperationReceipt"("organization_id", "operation_id");

-- AddForeignKey
ALTER TABLE "PaymentOperationReceipt" ADD CONSTRAINT "PaymentOperationReceipt_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOperationReceipt" ADD CONSTRAINT "PaymentOperationReceipt_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
