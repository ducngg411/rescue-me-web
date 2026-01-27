-- AlterEnum: Add MATCHING and EXPIRED to RequestStatus
ALTER TYPE "RequestStatus" ADD VALUE 'MATCHING';
ALTER TYPE "RequestStatus" ADD VALUE 'EXPIRED';
