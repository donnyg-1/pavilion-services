-- AlterTable
ALTER TABLE "Charge" ADD COLUMN     "referralCreditCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "referralCreditCapCents" INTEGER NOT NULL DEFAULT 2500,
ADD COLUMN     "referralCreditCents" INTEGER NOT NULL DEFAULT 500;

-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN     "referralCreditCents" INTEGER NOT NULL DEFAULT 0;
