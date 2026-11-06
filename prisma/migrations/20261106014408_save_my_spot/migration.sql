-- AlterEnum
ALTER TYPE "BookingSource" ADD VALUE 'saved_spot';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "nextTimeAt" TIMESTAMP(3);
