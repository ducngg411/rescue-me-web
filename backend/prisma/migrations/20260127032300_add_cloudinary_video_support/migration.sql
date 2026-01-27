-- CreateEnum
CREATE TYPE "StorageType" AS ENUM ('R2', 'CLOUDINARY');

-- AlterEnum
ALTER TYPE "UploadPurpose" ADD VALUE 'REQUEST_VIDEO';

-- AlterTable
ALTER TABLE "uploads" ADD COLUMN     "cloudinaryPublicId" TEXT,
ADD COLUMN     "cloudinaryResourceType" TEXT,
ADD COLUMN     "storageType" "StorageType" NOT NULL DEFAULT 'R2';
