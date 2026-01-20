-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('BREAKDOWN', 'ACCIDENT', 'FLAT_TIRE', 'BATTERY_DEAD', 'OUT_OF_FUEL', 'LOCKED_OUT', 'OTHER');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('CREATED', 'SEARCHING', 'MATCHED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- CreateTable
CREATE TABLE "rescue_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "incidentType" "IncidentType" NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "description" TEXT,
    "pickupLocation" JSONB NOT NULL,
    "dropoffLocation" JSONB,
    "status" "RequestStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rescue_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_media" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rescue_requests_userId_idx" ON "rescue_requests"("userId");

-- CreateIndex
CREATE INDEX "rescue_requests_status_idx" ON "rescue_requests"("status");

-- CreateIndex
CREATE INDEX "rescue_requests_createdAt_idx" ON "rescue_requests"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "request_media_objectKey_key" ON "request_media"("objectKey");

-- CreateIndex
CREATE INDEX "request_media_requestId_idx" ON "request_media"("requestId");

-- AddForeignKey
ALTER TABLE "rescue_requests" ADD CONSTRAINT "rescue_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_media" ADD CONSTRAINT "request_media_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "rescue_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
