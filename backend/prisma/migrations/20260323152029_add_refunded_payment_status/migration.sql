-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "dispute_read_states" ALTER COLUMN "updatedAt" DROP DEFAULT;
