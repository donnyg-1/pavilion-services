-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('draft', 'open', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "ShareBasis" AS ENUM ('price', 'commission');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending_setup', 'booked', 'cancelled', 'completed', 'charged', 'failed', 'refunded', 'expired');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('manager', 'board', 'facebook', 'flyer', 'referral', 'direct');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('open', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('pending', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('charge', 'refund');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('owed', 'paid');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('email', 'sms');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('sent', 'logged', 'failed');

-- CreateTable
CREATE TABLE "ManagementCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "stripeAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagementCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Community" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "city" TEXT,
    "managementCompanyId" TEXT,
    "stripeAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityAddress" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "raw" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "stripeAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'draft',
    "communityId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "whatsIncluded" TEXT NOT NULL DEFAULT '',
    "serviceDate" DATE NOT NULL,
    "backupDate" DATE,
    "rescheduledAt" TIMESTAMP(3),
    "arrivalWindow" TEXT NOT NULL DEFAULT '',
    "signupDeadline" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "normalPriceCents" INTEGER NOT NULL,
    "commissionBps" INTEGER NOT NULL DEFAULT 1500,
    "managerShareBps" INTEGER NOT NULL DEFAULT 400,
    "hoaShareBps" INTEGER NOT NULL DEFAULT 300,
    "shareBasis" "ShareBasis" NOT NULL DEFAULT 'price',
    "reserveFundLine" TEXT NOT NULL DEFAULT 'A share of every booking goes to {community}''s reserve fund.',
    "guaranteeLine" TEXT NOT NULL DEFAULT 'If you''re not happy, the crew comes back to make it right, or you get your money back.',
    "cancellationPolicy" TEXT NOT NULL DEFAULT 'Cancel free anytime before signups close. After that, contact us and we''ll work it out.',
    "peakBookedCount" INTEGER NOT NULL DEFAULT 0,
    "lockedPriceCents" INTEGER,
    "lockedAt" TIMESTAMP(3),
    "vendorToken" TEXT NOT NULL,
    "seriesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceTier" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "minHomes" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,

    CONSTRAINT "PriceTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddOn" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priceCents" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resident" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "communityAddressId" TEXT,
    "stripeCustomerId" TEXT,
    "smsOptIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "communityAddressId" TEXT NOT NULL,
    "unit" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" "BookingStatus" NOT NULL DEFAULT 'pending_setup',
    "source" "BookingSource" NOT NULL DEFAULT 'direct',
    "referralCode" TEXT NOT NULL,
    "referredById" TEXT,
    "publicToken" TEXT NOT NULL,
    "holdExpiresAt" TIMESTAMP(3),
    "stripeCheckoutId" TEXT,
    "stripePaymentMethodId" TEXT,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "routeOrder" INTEGER,
    "photoUrls" TEXT[],
    "bookedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingAddOn" (
    "bookingId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,

    CONSTRAINT "BookingAddOn_pkey" PRIMARY KEY ("bookingId","addOnId")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "source" "BookingSource" NOT NULL DEFAULT 'direct',
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddressReview" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "rawAddress" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AddressReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "ChargeStatus" NOT NULL DEFAULT 'pending',
    "stripePaymentIntentId" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "recoveryUrl" TEXT,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "type" "LedgerType" NOT NULL,
    "stripeRefId" TEXT,
    "finalPriceCents" INTEGER NOT NULL,
    "commissionCents" INTEGER NOT NULL,
    "managerShareCents" INTEGER NOT NULL,
    "hoaShareCents" INTEGER NOT NULL,
    "pavilionNetCents" INTEGER NOT NULL,
    "processingFeeCents" INTEGER NOT NULL,
    "feeAbsorbedCents" INTEGER NOT NULL DEFAULT 0,
    "vendorPayoutCents" INTEGER NOT NULL,
    "feeIsEstimate" BOOLEAN NOT NULL DEFAULT false,
    "commissionBps" INTEGER NOT NULL,
    "managerShareBps" INTEGER NOT NULL,
    "hoaShareBps" INTEGER NOT NULL,
    "shareBasis" "ShareBasis" NOT NULL,
    "vendorPayoutStatus" "PayoutStatus" NOT NULL DEFAULT 'owed',
    "managerPayoutStatus" "PayoutStatus" NOT NULL DEFAULT 'owed',
    "hoaPayoutStatus" "PayoutStatus" NOT NULL DEFAULT 'owed',
    "vendorPayoutRef" TEXT,
    "managerPayoutRef" TEXT,
    "hoaPayoutRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealVisit" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "source" "BookingSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "dealId" TEXT,
    "bookingId" TEXT,
    "channel" "MessageChannel" NOT NULL DEFAULT 'email',
    "template" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL,
    "providerId" TEXT,
    "error" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Community_slug_key" ON "Community"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityAddress_communityId_normalized_key" ON "CommunityAddress"("communityId", "normalized");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_slug_key" ON "Deal"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_vendorToken_key" ON "Deal"("vendorToken");

-- CreateIndex
CREATE UNIQUE INDEX "PriceTier_dealId_minHomes_key" ON "PriceTier"("dealId", "minHomes");

-- CreateIndex
CREATE UNIQUE INDEX "Resident_email_key" ON "Resident"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_referralCode_key" ON "Booking"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_publicToken_key" ON "Booking"("publicToken");

-- CreateIndex
CREATE INDEX "Booking_dealId_status_idx" ON "Booking"("dealId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_dealId_email_key" ON "WaitlistEntry"("dealId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Charge_stripePaymentIntentId_key" ON "Charge"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "LedgerEntry_dealId_idx" ON "LedgerEntry"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_bookingId_key" ON "Rating"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "DealVisit_dealId_visitorId_key" ON "DealVisit"("dealId", "visitorId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageLog_dedupeKey_key" ON "MessageLog"("dedupeKey");

-- CreateIndex
CREATE INDEX "MessageLog_dealId_idx" ON "MessageLog"("dealId");

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_managementCompanyId_fkey" FOREIGN KEY ("managementCompanyId") REFERENCES "ManagementCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityAddress" ADD CONSTRAINT "CommunityAddress_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceTier" ADD CONSTRAINT "PriceTier_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddOn" ADD CONSTRAINT "AddOn_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resident" ADD CONSTRAINT "Resident_communityAddressId_fkey" FOREIGN KEY ("communityAddressId") REFERENCES "CommunityAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_communityAddressId_fkey" FOREIGN KEY ("communityAddressId") REFERENCES "CommunityAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAddOn" ADD CONSTRAINT "BookingAddOn_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAddOn" ADD CONSTRAINT "BookingAddOn_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "AddOn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddressReview" ADD CONSTRAINT "AddressReview_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealVisit" ADD CONSTRAINT "DealVisit_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
