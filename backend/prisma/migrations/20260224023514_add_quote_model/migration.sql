-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "rescueRequestId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "estimatedArrivalMinutes" INTEGER NOT NULL,
    "message" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "userRespondedAt" TIMESTAMP(3),
    "providerLocation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quotes_rescueRequestId_idx" ON "quotes"("rescueRequestId");

-- CreateIndex
CREATE INDEX "quotes_providerId_idx" ON "quotes"("providerId");

-- CreateIndex
CREATE INDEX "quotes_status_idx" ON "quotes"("status");

-- CreateIndex
CREATE INDEX "quotes_createdAt_idx" ON "quotes"("createdAt");

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_rescueRequestId_fkey" FOREIGN KEY ("rescueRequestId") REFERENCES "rescue_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
