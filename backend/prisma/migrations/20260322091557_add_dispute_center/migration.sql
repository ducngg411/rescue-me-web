-- CreateEnum
CREATE TYPE "DisputeCaseStatus" AS ENUM ('NEW', 'IN_REVIEW', 'AWAITING_EVIDENCE', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DisputeResolution" AS ENUM ('FULL_REFUND', 'PARTIAL_REFUND', 'NO_CHANGE', 'DISMISSED');

-- CreateEnum
CREATE TYPE "DisputeMessageActor" AS ENUM ('SYSTEM', 'ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "DisputeVisibility" AS ENUM ('PUBLIC', 'INTERNAL');

-- CreateTable
CREATE TABLE "dispute_cases" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "openedByUserId" TEXT,
    "status" "DisputeCaseStatus" NOT NULL DEFAULT 'NEW',
    "slaDueAt" TIMESTAMP(3),
    "firstRespondedAt" TIMESTAMP(3),
    "resolution" "DisputeResolution",
    "refundAmount" INTEGER,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "assignedToUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispute_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_messages" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actor" "DisputeMessageActor" NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "DisputeVisibility" NOT NULL DEFAULT 'PUBLIC',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_evidence" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "note" TEXT,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dispute_cases_paymentId_key" ON "dispute_cases"("paymentId");

-- CreateIndex
CREATE INDEX "dispute_cases_requestId_idx" ON "dispute_cases"("requestId");

-- CreateIndex
CREATE INDEX "dispute_cases_status_idx" ON "dispute_cases"("status");

-- CreateIndex
CREATE INDEX "dispute_cases_slaDueAt_idx" ON "dispute_cases"("slaDueAt");

-- CreateIndex
CREATE INDEX "dispute_cases_createdAt_idx" ON "dispute_cases"("createdAt");

-- CreateIndex
CREATE INDEX "dispute_messages_caseId_idx" ON "dispute_messages"("caseId");

-- CreateIndex
CREATE INDEX "dispute_messages_createdAt_idx" ON "dispute_messages"("createdAt");

-- CreateIndex
CREATE INDEX "dispute_evidence_caseId_idx" ON "dispute_evidence"("caseId");

-- AddForeignKey
ALTER TABLE "dispute_cases" ADD CONSTRAINT "dispute_cases_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_cases" ADD CONSTRAINT "dispute_cases_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "rescue_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_cases" ADD CONSTRAINT "dispute_cases_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_cases" ADD CONSTRAINT "dispute_cases_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_cases" ADD CONSTRAINT "dispute_cases_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dispute_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dispute_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill dispute cases from existing DISPUTED payments
INSERT INTO "dispute_cases" (
    "id",
    "paymentId",
    "requestId",
    "openedByUserId",
    "status",
    "slaDueAt",
    "firstRespondedAt",
    "resolution",
    "refundAmount",
    "resolutionNote",
    "resolvedAt",
    "resolvedByUserId",
    "assignedToUserId",
    "createdAt",
    "updatedAt"
)
SELECT
    'dc_' || p."id",
    p."id",
    p."requestId",
    p."userId",
    'IN_REVIEW'::"DisputeCaseStatus",
    CASE
        WHEN p."disputedAt" IS NOT NULL THEN p."disputedAt" + interval '48 hours'
        ELSE NULL
    END,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    COALESCE(p."disputedAt", p."createdAt"),
    COALESCE(p."disputedAt", p."createdAt")
FROM "payments" p
WHERE p."status" = 'DISPUTED'
  AND NOT EXISTS (
        SELECT 1 FROM "dispute_cases" dc WHERE dc."paymentId" = p."id"
    );

INSERT INTO "dispute_messages" (
    "id",
    "caseId",
    "actor",
    "body",
    "visibility",
    "userId",
    "createdAt"
)
SELECT
    'dm_' || p."id",
    'dc_' || p."id",
    'SYSTEM',
    COALESCE('Initial dispute: ' || p."disputeReason", 'Payment disputed (no reason text).'),
    'PUBLIC'::"DisputeVisibility",
    NULL,
    COALESCE(p."disputedAt", p."createdAt")
FROM "payments" p
WHERE p."status" = 'DISPUTED';
