-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('TOWING', 'BATTERY_JUMP', 'TIRE_CHANGE', 'FUEL_DELIVERY', 'LOCKOUT', 'BREAKDOWN_REPAIR');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "businessAddress" JSONB,
ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "plateNumber" TEXT,
ADD COLUMN     "serviceRadiusKm" INTEGER,
ADD COLUMN     "serviceTypes" "ServiceType"[],
ADD COLUMN     "supportedVehicleTypes" "VehicleType"[],
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'DRAFT';
