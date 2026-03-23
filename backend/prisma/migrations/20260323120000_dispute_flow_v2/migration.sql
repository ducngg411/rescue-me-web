-- AlterTable
ALTER TABLE "dispute_cases"
  ADD COLUMN "customerMessageCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "providerMessageCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "customerReplyAllowed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "providerReplyAllowed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "providerUnresponsiveAt" TIMESTAMP(3),
  ADD COLUMN "lastCoordinatorNote" TEXT;

-- Backfill reply permissions based on current status.
UPDATE "dispute_cases"
SET
  "providerReplyAllowed" = CASE WHEN "status" = 'WAITING_FOR_PROVIDER' THEN true ELSE false END,
  "customerReplyAllowed" = CASE WHEN "status" = 'WAITING_FOR_CUSTOMER' THEN true ELSE false END;

-- AlterTable
ALTER TABLE "dispute_messages"
  ADD COLUMN "mediaUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "dispute_read_states" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastReadAt" TIMESTAMP(3),
  "lastMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dispute_read_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dispute_read_states_caseId_userId_key" ON "dispute_read_states"("caseId", "userId");

-- CreateIndex
CREATE INDEX "dispute_read_states_userId_updatedAt_idx" ON "dispute_read_states"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "dispute_read_states"
  ADD CONSTRAINT "dispute_read_states_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "dispute_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_read_states"
  ADD CONSTRAINT "dispute_read_states_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

