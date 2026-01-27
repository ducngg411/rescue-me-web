-- AlterTable: Add provider assignment and matching tracking fields
ALTER TABLE "rescue_requests" 
ADD COLUMN "assignedProviderId" TEXT,
ADD COLUMN "matchingStartedAt" TIMESTAMP(3),
ADD COLUMN "assignedAt" TIMESTAMP(3),
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "matchAttempts" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "rescue_requests_assignedProviderId_idx" ON "rescue_requests"("assignedProviderId");

-- AddForeignKey
ALTER TABLE "rescue_requests" ADD CONSTRAINT "rescue_requests_assignedProviderId_fkey" 
FOREIGN KEY ("assignedProviderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
