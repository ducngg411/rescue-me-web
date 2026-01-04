-- AlterTable
ALTER TABLE "users" ADD COLUMN     "rejectReasonCode" TEXT,
ADD COLUMN     "rejectReasonDetail" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3);
