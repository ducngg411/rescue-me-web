-- AlterTable
ALTER TABLE "request_media" ADD COLUMN     "cloudinaryPublicId" TEXT,
ADD COLUMN     "mediaType" TEXT NOT NULL DEFAULT 'IMAGE',
ALTER COLUMN "objectKey" DROP NOT NULL;
