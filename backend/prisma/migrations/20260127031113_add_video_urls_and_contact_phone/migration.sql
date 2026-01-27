-- AlterTable
ALTER TABLE "rescue_requests" ADD COLUMN     "contactPhone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "videoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
