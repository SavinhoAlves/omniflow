-- CreateEnum
CREATE TYPE "MessageDeliveryStatus" AS ENUM ('ACCEPTED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- AlterTable
ALTER TABLE "messages"
  ADD COLUMN "delivery_status" "MessageDeliveryStatus",
  ADD COLUMN "delivery_error_code" INTEGER;

-- CreateIndex
CREATE INDEX "messages_provider_message_id_idx" ON "messages"("provider_message_id");
