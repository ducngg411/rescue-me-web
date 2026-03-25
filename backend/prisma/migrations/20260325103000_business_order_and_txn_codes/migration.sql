-- Public business codes for cross-UI reconciliation (orderCode, txnCode).

ALTER TABLE "rescue_requests" ADD COLUMN "orderCode" TEXT;
CREATE UNIQUE INDEX "rescue_requests_orderCode_key" ON "rescue_requests"("orderCode");

ALTER TABLE "wallet_transactions" ADD COLUMN "txnCode" TEXT;
CREATE UNIQUE INDEX "wallet_transactions_txnCode_key" ON "wallet_transactions"("txnCode");

ALTER TABLE "user_wallet_transactions" ADD COLUMN "txnCode" TEXT;
CREATE UNIQUE INDEX "user_wallet_transactions_txnCode_key" ON "user_wallet_transactions"("txnCode");

ALTER TABLE "topup_transactions" ADD COLUMN "txnCode" TEXT;
CREATE UNIQUE INDEX "topup_transactions_txnCode_key" ON "topup_transactions"("txnCode");

ALTER TABLE "user_topup_transactions" ADD COLUMN "txnCode" TEXT;
CREATE UNIQUE INDEX "user_topup_transactions_txnCode_key" ON "user_topup_transactions"("txnCode");

ALTER TABLE "job_payment_transactions" ADD COLUMN "txnCode" TEXT;
CREATE UNIQUE INDEX "job_payment_transactions_txnCode_key" ON "job_payment_transactions"("txnCode");

UPDATE "rescue_requests"
SET "orderCode" = 'RMO-' || to_char("createdAt" AT TIME ZONE 'UTC', 'YYMMDD') || '-' || upper(substr(md5("id"::text), 1, 5))
WHERE "orderCode" IS NULL;

UPDATE "wallet_transactions"
SET "txnCode" = 'TXP' || upper(substr(md5("id"::text), 1, 7))
WHERE "txnCode" IS NULL;

UPDATE "user_wallet_transactions"
SET "txnCode" = 'TXU' || upper(substr(md5("id"::text), 1, 7))
WHERE "txnCode" IS NULL;

UPDATE "topup_transactions"
SET "txnCode" = 'TNP' || upper(substr(md5("id"::text), 1, 7))
WHERE "txnCode" IS NULL;

UPDATE "user_topup_transactions"
SET "txnCode" = 'TNU' || upper(substr(md5("id"::text), 1, 7))
WHERE "txnCode" IS NULL;

UPDATE "job_payment_transactions"
SET "txnCode" = 'JP' || upper(substr(md5("id"::text), 1, 8))
WHERE "txnCode" IS NULL;
