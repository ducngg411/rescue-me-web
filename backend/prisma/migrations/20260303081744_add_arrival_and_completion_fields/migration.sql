/*
  Warnings:

  - A unique constraint covering the columns `[rescueRequestId,providerId]` on the table `quotes` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RequestStatus" ADD VALUE 'ARRIVED';
ALTER TYPE "RequestStatus" ADD VALUE 'WORKING';

-- AlterTable
ALTER TABLE "rescue_requests" ADD COLUMN     "declinedProviders" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "maxQuotes" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "quoteCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quoteWindowClosedAt" TIMESTAMP(3),
ADD COLUMN     "quoteWindowDuration" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "quoteWindowExpiresAt" TIMESTAMP(3),
ADD COLUMN     "viewingProviders" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "viewingUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "quotes_rescueRequestId_status_idx" ON "quotes"("rescueRequestId", "status");

-- CreateIndex
CREATE INDEX "quotes_status_expiresAt_idx" ON "quotes"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_rescueRequestId_providerId_key" ON "quotes"("rescueRequestId", "providerId");
