/*
  Warnings:

  - You are about to drop the column `carPlateNumber` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `motorcyclePlateNumber` on the `users` table. All the data in the column will be lost.

*/

-- Step 1: Add new rescueVehicles column
ALTER TABLE "users" ADD COLUMN "rescueVehicles" JSONB;

-- Step 2: Migrate existing data from carPlateNumber and motorcyclePlateNumber to rescueVehicles
-- Build JSON array of vehicles based on existing plate numbers
UPDATE "users"
SET "rescueVehicles" = (
  SELECT jsonb_agg(vehicle)
  FROM (
    SELECT jsonb_build_object(
      'type', 'CAR',
      'plateNumber', "carPlateNumber",
      'isPrimary', true
    ) AS vehicle
    WHERE "carPlateNumber" IS NOT NULL
    
    UNION ALL
    
    SELECT jsonb_build_object(
      'type', 'MOTORCYCLE',
      'plateNumber', "motorcyclePlateNumber",
      'isPrimary', CASE WHEN "carPlateNumber" IS NULL THEN true ELSE false END
    ) AS vehicle
    WHERE "motorcyclePlateNumber" IS NOT NULL
  ) vehicles
)
WHERE "carPlateNumber" IS NOT NULL OR "motorcyclePlateNumber" IS NOT NULL;

-- Step 3: Drop old columns
ALTER TABLE "users" DROP COLUMN "carPlateNumber";
ALTER TABLE "users" DROP COLUMN "motorcyclePlateNumber";
