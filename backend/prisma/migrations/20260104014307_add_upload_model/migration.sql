-- CreateEnum
CREATE TYPE "UploadPurpose" AS ENUM ('PROVIDER_VERIFICATION', 'REQUEST_PHOTO', 'REVIEW_PHOTO', 'BEFORE_AFTER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CITIZEN_ID_FRONT', 'CITIZEN_ID_BACK', 'SELFIE', 'MOTORBIKE_PHOTO');

-- CreateTable
CREATE TABLE "uploads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "UploadPurpose" NOT NULL,
    "docType" "DocumentType",
    "objectKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uploads_objectKey_key" ON "uploads"("objectKey");

-- CreateIndex
CREATE INDEX "uploads_userId_idx" ON "uploads"("userId");

-- CreateIndex
CREATE INDEX "uploads_purpose_idx" ON "uploads"("purpose");

-- CreateIndex
CREATE INDEX "uploads_objectKey_idx" ON "uploads"("objectKey");

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
