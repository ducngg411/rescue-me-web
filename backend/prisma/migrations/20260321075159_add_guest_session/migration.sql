-- CreateEnum
CREATE TYPE "RequesterType" AS ENUM ('USER', 'GUEST');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "guestSessionId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "rescue_requests" ADD COLUMN     "guestSessionId" TEXT,
ADD COLUMN     "requesterType" "RequesterType" NOT NULL DEFAULT 'USER',
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "guest_sessions" (
    "id" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "phoneVerifiedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deviceId" TEXT,
    "lastIp" TEXT,
    "isConverted" BOOLEAN NOT NULL DEFAULT false,
    "convertedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guest_sessions_phoneNormalized_idx" ON "guest_sessions"("phoneNormalized");

-- CreateIndex
CREATE INDEX "guest_sessions_expiresAt_idx" ON "guest_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "rescue_requests_guestSessionId_status_idx" ON "rescue_requests"("guestSessionId", "status");

-- AddForeignKey
ALTER TABLE "rescue_requests" ADD CONSTRAINT "rescue_requests_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "guest_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
