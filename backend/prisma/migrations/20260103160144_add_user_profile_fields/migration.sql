-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('CAR', 'MOTORCYCLE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "defaultAddress" JSONB,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "licensePlate" TEXT,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "vehicleColor" TEXT,
ADD COLUMN     "vehicleType" "VehicleType";
