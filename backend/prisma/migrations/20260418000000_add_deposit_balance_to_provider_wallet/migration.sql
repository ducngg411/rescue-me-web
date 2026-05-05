-- ============================================================
-- Migration: 20260418000000_add_deposit_balance_to_provider_wallet
-- This migration was applied to the DB but the file was missing locally.
-- Reconstructed from the drift report to match the actual DB state.
-- All statements use IF NOT EXISTS / DO blocks for idempotency.
-- ============================================================

-- AlterTable payments: add commissionRate, remove legacy columns
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "commissionRate" DOUBLE PRECISION;
ALTER TABLE "payments" DROP COLUMN IF EXISTS "distanceFee";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "overtimeFee";

-- AlterTable quotes: remove legacy columns
ALTER TABLE "quotes" DROP COLUMN IF EXISTS "providerLocation";
ALTER TABLE "quotes" DROP COLUMN IF EXISTS "rejectionReason";

-- AlterTable users: add fcmToken
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fcmToken" TEXT;

-- CreateEnum BankCode (idempotent)
DO $$ BEGIN
    CREATE TYPE "BankCode" AS ENUM (
        'VCB','BIDV','TCB','MB','ACB','VPB','CTG','TPB','STB',
        'OCB','HDB','VIB','NAB','SCB','BAB','PGB','AGR'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum AuditChangeType (idempotent)
DO $$ BEGIN
    CREATE TYPE "AuditChangeType" AS ENUM ('FEE_RATE', 'BANK_ACCOUNT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable provider_withdrawal_accounts (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "provider_withdrawal_accounts" (
    "id"                TEXT        NOT NULL,
    "providerId"        TEXT        NOT NULL,
    "accountNumber"     TEXT        NOT NULL,
    "bankCode"          "BankCode",
    "bankName"          TEXT        NOT NULL,
    "branchName"        TEXT,
    "accountHolderName" TEXT        NOT NULL,
    "isDefault"         BOOLEAN     NOT NULL DEFAULT false,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "provider_withdrawal_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "provider_withdrawal_accounts_providerId_idx"
    ON "provider_withdrawal_accounts"("providerId");

DO $$ BEGIN
    ALTER TABLE "provider_withdrawal_accounts"
        ADD CONSTRAINT "provider_withdrawal_accounts_providerId_fkey"
        FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable customer_withdrawal_accounts (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "customer_withdrawal_accounts" (
    "id"                TEXT        NOT NULL,
    "userId"            TEXT        NOT NULL,
    "accountNumber"     TEXT        NOT NULL,
    "bankCode"          "BankCode",
    "bankName"          TEXT        NOT NULL,
    "branchName"        TEXT,
    "accountHolderName" TEXT        NOT NULL,
    "isDefault"         BOOLEAN     NOT NULL DEFAULT false,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_withdrawal_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "customer_withdrawal_accounts_userId_idx"
    ON "customer_withdrawal_accounts"("userId");

DO $$ BEGIN
    ALTER TABLE "customer_withdrawal_accounts"
        ADD CONSTRAINT "customer_withdrawal_accounts_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable platform_configs (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "platform_configs" (
    "id"        TEXT         NOT NULL,
    "key"       TEXT         NOT NULL,
    "value"     TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platform_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_configs_key_key" ON "platform_configs"("key");

-- CreateTable fee_audit_logs (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "fee_audit_logs" (
    "id"         TEXT              NOT NULL,
    "adminId"    TEXT              NOT NULL,
    "adminName"  TEXT              NOT NULL,
    "changeType" "AuditChangeType" NOT NULL,
    "oldValue"   TEXT,
    "newValue"   TEXT              NOT NULL,
    "note"       TEXT,
    "createdAt"  TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fee_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fee_audit_logs_createdAt_idx" ON "fee_audit_logs"("createdAt");

-- NOTE: sepayId/sepayReferenceCode columns already exist on cloud DB.
-- Skipping ADD COLUMN here to avoid duplicate constraint error.
-- These columns will be dropped by migration 20260505023623_remove_sepay_from_wallet_transaction.
