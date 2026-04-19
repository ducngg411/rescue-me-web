-- CreateEnum (idempotent)
DO $$ BEGIN
    CREATE TYPE "AuditChangeType" AS ENUM ('FEE_RATE', 'BANK_ACCOUNT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: platform_configs
CREATE TABLE IF NOT EXISTS "platform_configs" (
    "id"        TEXT        NOT NULL,
    "key"       TEXT        NOT NULL,
    "value"     TEXT        NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_configs_key_key" ON "platform_configs"("key");

-- CreateTable: fee_audit_logs
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
