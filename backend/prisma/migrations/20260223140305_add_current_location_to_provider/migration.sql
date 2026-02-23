-- AlterTable
ALTER TABLE "users" ADD COLUMN     "currentLocation" JSONB,
ADD COLUMN     "lastLocationUpdate" TIMESTAMP(3);
