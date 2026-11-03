-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "agreementSignedAt" DATE,
ADD COLUMN     "insuranceExpiresAt" DATE,
ADD COLUMN     "insuranceNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "payoutDetailsAt" DATE;
