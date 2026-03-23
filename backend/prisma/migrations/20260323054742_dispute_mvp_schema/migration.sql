/*
  Warnings:

  - The values [NEW,IN_REVIEW,AWAITING_EVIDENCE] on the enum `DisputeCaseStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `refundAmount` on the `dispute_cases` table. All the data in the column will be lost.
  - You are about to drop the column `resolution` on the `dispute_cases` table. All the data in the column will be lost.
  - You are about to drop the column `slaDueAt` on the `dispute_cases` table. All the data in the column will be lost.
  - You are about to drop the column `actor` on the `dispute_messages` table. All the data in the column will be lost.
  - Added the required column `openedByRole` to the `dispute_cases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reason` to the `dispute_cases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `senderRole` to the `dispute_messages` table without a default value. This is not possible if the table is not empty.

*/

-- CreateEnum
CREATE TYPE "DisputeResolutionType" AS ENUM ('FULL_REFUND', 'PARTIAL_REFUND', 'SPLIT', 'NO_REFUND');

-- CreateEnum
CREATE TYPE "DisputeOpenedByRole" AS ENUM ('CUSTOMER', 'PROVIDER');

-- CreateEnum
CREATE TYPE "DisputeSenderRole" AS ENUM ('CUSTOMER', 'PROVIDER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DisputeMessageType" AS ENUM ('TEXT', 'EVIDENCE', 'SYSTEM');

-- AlterEnum: replace DisputeCaseStatus with new values, migrating existing rows first
BEGIN;
CREATE TYPE "DisputeCaseStatus_new" AS ENUM ('WAITING_FOR_PROVIDER', 'WAITING_FOR_CUSTOMER', 'INVESTIGATING', 'RESOLVED', 'REJECTED');
ALTER TABLE "dispute_cases" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "dispute_cases" ALTER COLUMN "status" TYPE "DisputeCaseStatus_new" USING (
  CASE "status"::text
    WHEN 'NEW'               THEN 'INVESTIGATING'::"DisputeCaseStatus_new"
    WHEN 'IN_REVIEW'         THEN 'INVESTIGATING'::"DisputeCaseStatus_new"
    WHEN 'AWAITING_EVIDENCE' THEN 'INVESTIGATING'::"DisputeCaseStatus_new"
    WHEN 'RESOLVED'          THEN 'RESOLVED'::"DisputeCaseStatus_new"
    WHEN 'REJECTED'          THEN 'REJECTED'::"DisputeCaseStatus_new"
    ELSE                          'INVESTIGATING'::"DisputeCaseStatus_new"
  END
);
ALTER TYPE "DisputeCaseStatus" RENAME TO "DisputeCaseStatus_old";
ALTER TYPE "DisputeCaseStatus_new" RENAME TO "DisputeCaseStatus";
DROP TYPE "DisputeCaseStatus_old";
ALTER TABLE "dispute_cases" ALTER COLUMN "status" SET DEFAULT 'WAITING_FOR_PROVIDER';
COMMIT;

-- DropIndex
DROP INDEX "dispute_cases_slaDueAt_idx";

-- AlterTable: dispute_cases
-- Step 1: Add required columns WITH temporary defaults so existing rows get populated
ALTER TABLE "dispute_cases"
  DROP COLUMN "refundAmount",
  DROP COLUMN "resolution",
  DROP COLUMN "slaDueAt",
  ADD COLUMN "description"              TEXT,
  ADD COLUMN "expectedOutcome"          TEXT,
  ADD COLUMN "firstResponseDueAt"       TIMESTAMP(3),
  ADD COLUMN "openedByRole"             "DisputeOpenedByRole" NOT NULL DEFAULT 'CUSTOMER',
  ADD COLUMN "reason"                   TEXT NOT NULL DEFAULT 'dispute',
  ADD COLUMN "resolutionAmountCustomer" INTEGER,
  ADD COLUMN "resolutionAmountProvider" INTEGER,
  ADD COLUMN "resolutionDueAt"          TIMESTAMP(3),
  ADD COLUMN "resolutionType"           "DisputeResolutionType",
  ADD COLUMN "targetAmount"             INTEGER NOT NULL DEFAULT 0,
  ALTER COLUMN "status" SET DEFAULT 'WAITING_FOR_PROVIDER';

-- Step 2: Drop the temporary defaults (Prisma schema defines these as required with no default)
ALTER TABLE "dispute_cases" ALTER COLUMN "openedByRole" DROP DEFAULT;
ALTER TABLE "dispute_cases" ALTER COLUMN "reason"       DROP DEFAULT;

-- AlterTable: dispute_messages
-- Step 1: Add senderRole with temp default, migrate data from actor, then drop default
ALTER TABLE "dispute_messages"
  ADD COLUMN "messageType" "DisputeMessageType" NOT NULL DEFAULT 'TEXT',
  ADD COLUMN "senderRole"  "DisputeSenderRole"  NOT NULL DEFAULT 'ADMIN';

-- Step 2: Migrate actor → senderRole for existing messages
UPDATE "dispute_messages" SET "senderRole" =
  CASE "actor"::text
    WHEN 'USER'   THEN 'CUSTOMER'::"DisputeSenderRole"
    WHEN 'ADMIN'  THEN 'ADMIN'::"DisputeSenderRole"
    WHEN 'SYSTEM' THEN 'SYSTEM'::"DisputeSenderRole"
    ELSE               'ADMIN'::"DisputeSenderRole"
  END;

-- Step 3: Drop actor column and remove the temp default from senderRole
ALTER TABLE "dispute_messages" DROP COLUMN "actor";
ALTER TABLE "dispute_messages" ALTER COLUMN "senderRole" DROP DEFAULT;

-- DropEnum
DROP TYPE IF EXISTS "DisputeMessageActor";

-- DropEnum
DROP TYPE IF EXISTS "DisputeResolution";

-- CreateIndex
CREATE INDEX "dispute_cases_firstResponseDueAt_idx" ON "dispute_cases"("firstResponseDueAt");

-- CreateIndex
CREATE INDEX "dispute_cases_resolutionDueAt_idx" ON "dispute_cases"("resolutionDueAt");
