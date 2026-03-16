DO $$
BEGIN
    CREATE TYPE "UserWalletReferenceType" AS ENUM ('TOPUP', 'JOB_PAYMENT', 'REFUND', 'WITHDRAW', 'ADJUSTMENT');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "WalletReferenceType" ADD VALUE IF NOT EXISTS 'TOPUP';
ALTER TYPE "WalletReferenceType" ADD VALUE IF NOT EXISTS 'JOB_PAYMENT';

ALTER TABLE "provider_wallets" ADD COLUMN IF NOT EXISTS "topupCode" TEXT;
ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "holdReleaseAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "topup_transactions" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "transferCode" TEXT NOT NULL,
    "sepayId" INTEGER,
    "sepayReferenceCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expireAt" TIMESTAMP(3),
    CONSTRAINT "topup_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "job_payment_transactions" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "transferCode" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expireAt" TIMESTAMP(3) NOT NULL,
    "sepayId" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_payment_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "availableBalance" INTEGER NOT NULL DEFAULT 0,
    "pendingBalance" INTEGER NOT NULL DEFAULT 0,
    "topupCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_wallets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_wallet_transactions" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "WalletTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "referenceType" "UserWalletReferenceType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "description" TEXT,
    "holdReleaseAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_wallet_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_topup_transactions" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "transferCode" TEXT NOT NULL,
    "sepayId" INTEGER,
    "sepayReferenceCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expireAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "user_topup_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "topup_transactions_sepayId_key" ON "topup_transactions"("sepayId");
CREATE INDEX IF NOT EXISTS "topup_transactions_walletId_idx" ON "topup_transactions"("walletId");
CREATE INDEX IF NOT EXISTS "topup_transactions_walletId_status_idx" ON "topup_transactions"("walletId", "status");
CREATE INDEX IF NOT EXISTS "topup_transactions_transferCode_idx" ON "topup_transactions"("transferCode");

CREATE UNIQUE INDEX IF NOT EXISTS "job_payment_transactions_requestId_key" ON "job_payment_transactions"("requestId");
CREATE UNIQUE INDEX IF NOT EXISTS "job_payment_transactions_paymentId_key" ON "job_payment_transactions"("paymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "job_payment_transactions_transferCode_key" ON "job_payment_transactions"("transferCode");
CREATE UNIQUE INDEX IF NOT EXISTS "job_payment_transactions_sepayId_key" ON "job_payment_transactions"("sepayId");
CREATE INDEX IF NOT EXISTS "job_payment_transactions_transferCode_idx" ON "job_payment_transactions"("transferCode");
CREATE INDEX IF NOT EXISTS "job_payment_transactions_requestId_status_idx" ON "job_payment_transactions"("requestId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "user_wallets_userId_key" ON "user_wallets"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "user_wallets_topupCode_key" ON "user_wallets"("topupCode");
CREATE INDEX IF NOT EXISTS "user_wallets_userId_idx" ON "user_wallets"("userId");

CREATE INDEX IF NOT EXISTS "user_wallet_transactions_walletId_idx" ON "user_wallet_transactions"("walletId");
CREATE INDEX IF NOT EXISTS "user_wallet_transactions_walletId_status_idx" ON "user_wallet_transactions"("walletId", "status");
CREATE INDEX IF NOT EXISTS "user_wallet_transactions_referenceType_referenceId_idx" ON "user_wallet_transactions"("referenceType", "referenceId");
CREATE INDEX IF NOT EXISTS "user_wallet_transactions_createdAt_idx" ON "user_wallet_transactions"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "user_topup_transactions_sepayId_key" ON "user_topup_transactions"("sepayId");
CREATE INDEX IF NOT EXISTS "user_topup_transactions_walletId_idx" ON "user_topup_transactions"("walletId");
CREATE INDEX IF NOT EXISTS "user_topup_transactions_walletId_status_idx" ON "user_topup_transactions"("walletId", "status");
CREATE INDEX IF NOT EXISTS "user_topup_transactions_transferCode_idx" ON "user_topup_transactions"("transferCode");

CREATE UNIQUE INDEX IF NOT EXISTS "provider_wallets_topupCode_key" ON "provider_wallets"("topupCode");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'topup_transactions_walletId_fkey'
    ) THEN
        ALTER TABLE "topup_transactions"
        ADD CONSTRAINT "topup_transactions_walletId_fkey"
        FOREIGN KEY ("walletId") REFERENCES "provider_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_wallets_userId_fkey'
    ) THEN
        ALTER TABLE "user_wallets"
        ADD CONSTRAINT "user_wallets_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_wallet_transactions_walletId_fkey'
    ) THEN
        ALTER TABLE "user_wallet_transactions"
        ADD CONSTRAINT "user_wallet_transactions_walletId_fkey"
        FOREIGN KEY ("walletId") REFERENCES "user_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_topup_transactions_walletId_fkey'
    ) THEN
        ALTER TABLE "user_topup_transactions"
        ADD CONSTRAINT "user_topup_transactions_walletId_fkey"
        FOREIGN KEY ("walletId") REFERENCES "user_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
