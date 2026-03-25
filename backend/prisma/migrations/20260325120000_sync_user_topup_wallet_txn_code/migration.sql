-- Align user wallet TOPUP ledger txnCode with UserTopupTransaction (TNU…) for old rows
-- created before webhook reused the topup reconciliation code.

UPDATE "user_wallet_transactions" AS u
SET "txnCode" = t."txnCode"
FROM "user_topup_transactions" AS t
WHERE u."referenceType" = 'TOPUP'
  AND u."referenceId" = t.id
  AND t."txnCode" IS NOT NULL
  AND u."txnCode" IS DISTINCT FROM t."txnCode";

-- Provider: wallet ledger used TXP… while topup row had TNP…; referenceId stored SePay id as text.
UPDATE "wallet_transactions" AS w
SET "txnCode" = t."txnCode"
FROM "topup_transactions" AS t
WHERE w."referenceType" = 'TOPUP'
  AND t."sepayId" IS NOT NULL
  AND w."referenceId" = t."sepayId"::text
  AND t."txnCode" IS NOT NULL
  AND w."txnCode" IS DISTINCT FROM t."txnCode";
