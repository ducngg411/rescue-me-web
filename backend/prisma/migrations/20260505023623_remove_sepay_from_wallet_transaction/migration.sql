/*
  Warnings:

  - You are about to drop the column `sepayId` on the `user_wallet_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `sepayReferenceCode` on the `user_wallet_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `sepayId` on the `wallet_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `sepayReferenceCode` on the `wallet_transactions` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "user_wallet_transactions_sepayId_key";

-- DropIndex
DROP INDEX "wallet_transactions_sepayId_key";

-- AlterTable
ALTER TABLE "user_wallet_transactions" DROP COLUMN "sepayId",
DROP COLUMN "sepayReferenceCode";

-- AlterTable
ALTER TABLE "wallet_transactions" DROP COLUMN "sepayId",
DROP COLUMN "sepayReferenceCode";
