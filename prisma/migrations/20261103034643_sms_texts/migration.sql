-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "onTheWayAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Resident" ADD COLUMN     "smsConsentAt" TIMESTAMP(3),
ADD COLUMN     "smsOptedOutAt" TIMESTAMP(3);
