/*
  Warnings:

  - You are about to drop the column `plateNumber` on the `users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- AlterTable
ALTER TABLE "users" DROP COLUMN "plateNumber",
ADD COLUMN     "carPlateNumber" TEXT,
ADD COLUMN     "motorcyclePlateNumber" TEXT,
ADD COLUMN     "permanentAddress" JSONB,
ADD COLUMN     "providerType" "ProviderType";
