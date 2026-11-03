// Seeds one example deal ("Gutter Day") so the whole flow can be clicked through.
// Vendor, community and prices are placeholders.
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizeAddress } from "../src/lib/domain/address";
import { publicToken, referralCode } from "../src/lib/tokens";
import { addDays, mountainLocalToUtc, mountainToday } from "../src/lib/dates";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// A fictional Utah County grid neighborhood plus a couple of named streets.
function placeholderAddresses(): string[] {
  const list: string[] = [];
  for (let n = 1200; n <= 1580; n += 20) list.push(`${n} N 500 E`);
  for (let n = 1210; n <= 1570; n += 20) list.push(`${n} N 600 E`);
  for (let n = 510; n <= 590; n += 20) list.push(`${n} E 1300 N`);
  for (let n = 10; n <= 90; n += 10) list.push(`${n} W Willow Creek Dr`);
  for (let n = 2201; n <= 2245; n += 4) list.push(`${n} Sage Hollow Ln`);
  return list;
}

async function main() {
  const existing = await db.deal.findUnique({ where: { slug: "gutter-day" } });
  if (existing) {
    console.log("Seed data already exists (deal 'gutter-day'). Reset the database to reseed.");
    return;
  }

  const mgmt = await db.managementCompany.create({ data: { name: "Placeholder Community Management", contactName: "Jordan Example", contactEmail: "manager@example.com" } });
  const community = await db.community.create({ data: { name: "Sunset Ridge", slug: "sunset-ridge", city: "Lehi", managementCompanyId: mgmt.id } });

  const addresses = placeholderAddresses();
  await db.communityAddress.createMany({
    data: addresses.map((raw) => ({ communityId: community.id, raw, normalized: normalizeAddress(raw)!.key })),
  });

  const vendor = await db.vendor.create({ data: { name: "Example Gutter Co.", contactName: "Sam Placeholder", email: "crew@example.com", phone: "(801) 555-0142" } });

  const service = addDays(mountainToday(), 21);
  const deal = await db.deal.create({
    data: {
      slug: "gutter-day",
      status: "open",
      communityId: community.id,
      vendorId: vendor.id,
      title: "Gutter Day",
      serviceName: "Gutter cleaning",
      description: "Clear out the fall leaves before the snow. The crew cleans every gutter on your home and makes sure the water drains away from your foundation.",
      whatsIncluded: [
        "All gutters cleared by hand, debris bagged and hauled away",
        "Downspouts checked for clogs",
        "Roof valleys cleared of loose debris",
        "Before and after photos on request",
      ].join("\n"),
      serviceDate: new Date(`${service}T00:00:00Z`),
      backupDate: new Date(`${addDays(service, 7)}T00:00:00Z`),
      arrivalWindow: "8am–5pm",
      signupDeadline: mountainLocalToUtc(`${addDays(service, -5)}T20:00`)!,
      capacity: 40,
      normalPriceCents: 19900,
      tiers: {
        create: [
          { minHomes: 1, priceCents: 16900 },
          { minHomes: 5, priceCents: 14900 },
          { minHomes: 10, priceCents: 12900 },
          { minHomes: 20, priceCents: 11900 },
        ],
      },
      addOns: {
        create: [
          { name: "Downspout flush", description: "Water-flush every downspout to clear deep clogs", priceCents: 2500, sortOrder: 0 },
          { name: "Gutter guard inspection", description: "Check existing guards and reseat loose sections", priceCents: 1500, sortOrder: 1 },
        ],
      },
    },
  });

  // Three sample bookings so the tier progress isn't empty. Mock cards, so only for mock mode.
  if (!process.env.STRIPE_SECRET_KEY) {
    const samples = [
      { name: "Avery Sample", email: "avery@example.com", address: "1240 N 500 E", source: "manager" as const },
      { name: "Blake Sample", email: "blake@example.com", address: "1260 N 500 E", source: "facebook" as const },
      { name: "Casey Sample", email: "casey@example.com", address: "20 W Willow Creek Dr", source: "referral" as const },
    ];
    let first: string | null = null;
    for (const s of samples) {
      const addr = await db.communityAddress.findFirstOrThrow({ where: { communityId: community.id, normalized: normalizeAddress(s.address)!.key } });
      const resident = await db.resident.create({ data: { name: s.name, email: s.email, phone: "(801) 555-0100", communityAddressId: addr.id, stripeCustomerId: `cus_mock_${s.email}`, smsOptIn: true, smsConsentAt: new Date() } });
      const b: { id: string } = await db.booking.create({
        data: {
          dealId: deal.id,
          residentId: resident.id,
          communityAddressId: addr.id,
          status: "booked",
          source: s.source,
          referredById: s.source === "referral" ? first : null,
          referralCode: referralCode(),
          publicToken: publicToken(),
          stripePaymentMethodId: "pm_mock_ok",
          cardBrand: "visa",
          cardLast4: "4242",
          bookedAt: new Date(),
        },
      });
      first ??= b.id;
    }
    await db.deal.update({ where: { id: deal.id }, data: { peakBookedCount: samples.length } });
    await db.dealVisit.createMany({
      data: [
        ...Array.from({ length: 9 }, (_, i) => ({ dealId: deal.id, visitorId: `seed-m-${i}`, source: "manager" as const })),
        ...Array.from({ length: 6 }, (_, i) => ({ dealId: deal.id, visitorId: `seed-f-${i}`, source: "facebook" as const })),
        ...Array.from({ length: 2 }, (_, i) => ({ dealId: deal.id, visitorId: `seed-r-${i}`, source: "referral" as const })),
      ],
    });
  }

  console.log(`Seeded "Gutter Day" for Sunset Ridge with ${addresses.length} addresses.`);
  console.log(`  Resident page: /d/gutter-day`);
  console.log(`  Admin:         /admin (password from ADMIN_PASSWORD)`);
  console.log(`  Try booking:   1300 N 500 E (on the list) or 999 Nowhere St (not on the list)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
