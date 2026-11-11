-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "occupants" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "emergencyName" TEXT,
ADD COLUMN     "emergencyPhone" TEXT,
ADD COLUMN     "emergencyRelation" TEXT,
ADD COLUMN     "employer" TEXT,
ADD COLUMN     "idNumber" TEXT,
ADD COLUMN     "idType" TEXT,
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "permanentAddress" TEXT;
