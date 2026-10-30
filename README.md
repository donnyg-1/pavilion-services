# Pavilion Services

Neighborhood service days for HOA communities. Residents book a vetted local vendor through one link per deal, the price drops as more neighbors book, and cards are charged only after the job is done. No app, no resident accounts.

This is Milestone 1: everything needed to run one real service day in one community.

## Quick start (local)

Requires Node 20+ and Postgres.

```bash
cp .env.example .env          # then edit DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET
npm install
npx prisma migrate deploy
npm run db:seed               # creates the example "Gutter Day" deal
npm run dev
```

- Resident page: http://localhost:3000/d/gutter-day
- Admin: http://localhost:3000/admin (password = `ADMIN_PASSWORD`)

With no Stripe or Resend keys, the app runs in **mock mode**:

- **Payments:** a stand-in checkout page lets you pick a test card that succeeds, gets declined later, or needs authentication later.
- **Email:** emails go to the admin **Outbox** (`/admin/outbox`), where you can read each one exactly as a resident would see it.

The admin header always shows which mode you're in.

### Click through the whole flow

1. Open `/d/gutter-day?src=flyer`. The seed data has 3 homes booked, so it shows "2 more → $149".
2. Book `1300 North 500 East`. Messy spellings match `1300 N 500 E` on the list. Try `999 Nowhere St` to see "Not on the list? Request review".
3. On the confirmation page, copy the share link and book a second home with it. That booking counts as a neighbor referral.
4. Book a few more homes and choose the "declined" and "needs authentication" test cards for some of them.
5. Admin → Gutter Day → **Close signups now**. This locks the price and emails everyone their final price.
6. Bookings tab → select all → **Complete & charge selected**. Successful charges send receipts. Failed charges email the resident a payment link (open it from the Outbox).
7. Refund one booking, then look at the **Ledger** tab and export it.
8. Overview → **Move & notify** to reschedule everyone to the rain date.
9. Click a 1–5 link in a receipt email to leave a rating.

## Tests

```bash
npm test                    # unit tests: pricing tiers, capacity/waitlist, address matching, charge/ledger math, CSV
npm run db:reset            # fresh seed data (the e2e test needs signups open)
npm run test:e2e            # browser test: book → close signups → charge → ledger (mock mode)
```

## Real Stripe (test mode)

1. In the Stripe dashboard (test mode), copy the secret key into `STRIPE_SECRET_KEY`.
2. Forward webhooks locally with the [Stripe CLI](https://stripe.com/docs/stripe-cli):
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Put the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`. (The success redirects also sync with Stripe, so bookings confirm even without the webhook. The webhook is the safety net.)
3. Reseed. Sample bookings are only created in mock mode, because they don't have real saved cards.
4. Test cards: `4242 4242 4242 4242` (succeeds), `4000 0027 6000 3184` (needs authentication when charged later), `4000 0000 0000 0341` (saves fine, declined when charged later).

How payments work:

- **Booking:** Stripe Checkout in setup mode saves the card. Nothing is charged.
- **Mark complete:** an off-session PaymentIntent charges the locked price plus add-ons.
- **Declines and authentication:** the resident is emailed a link that opens a fresh Checkout payment page.
- **Ledger:** uses Stripe's actual processing fee from the balance transaction. In mock mode the fee is estimated at 2.9% + 30¢.

## Email (Resend)

Set `RESEND_API_KEY` and `EMAIL_FROM`. Until you verify a sending domain in Resend, you can only send to your own address from `onboarding@resend.dev`. Every email is still saved to the Outbox either way.

## Deploy (Vercel)

1. Create a Postgres database (Neon through the Vercel integration is easiest) and set `DATABASE_URL`.
2. Set every variable from `.env.example` in Vercel. Set `APP_URL` to the deployed URL.
3. Run `npx prisma migrate deploy` against the production database, then seed or create real data in the admin.
4. `vercel.json` schedules `/api/cron/daily` once a day (16:00 UTC, which is 9–10am Mountain). It sends the day-before reminders and locks any deal whose deadline passed. Deadlines also lock on the next page view, so nothing depends on cron timing. Vercel sends `CRON_SECRET` automatically.
5. Add a Stripe webhook endpoint at `https://<your-app>/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.expired`.

## How the rules are implemented

| Rule | Where |
|---|---|
| Price only drops; tiers unlock off the **peak** booked count, so cancellations never raise it | `src/lib/domain/pricing.ts` |
| Tier locks at the deadline (`lockDealIfDue`, idempotent, runs on page views and cron) | `src/lib/services/deals.ts` |
| Capacity, waitlist, and holding a spot during card entry (row lock per deal, so the last spot can't be double-booked) | `src/lib/domain/capacity.ts`, `src/lib/services/booking.ts` |
| Address normalization for Utah grid and named streets | `src/lib/domain/address.ts` |
| Commission / manager / HOA / processing / vendor math, refunds | `src/lib/domain/ledger.ts` |
| Attribution (`?src=manager\|board\|facebook\|flyer`, `?ref=CODE`), first-touch visit tracking for conversion | `src/app/d/[slug]/attribution.tsx`, `src/app/api/visit` |

Decisions made for the pilot:

- **Commission split is still open:** each deal chooses whether the manager and HOA shares are a % of the *final price* (default: 15% commission, 4% manager, 3% HOA, so Pavilion keeps 8%) or a % of *Pavilion's commission*. The rates are copied onto every ledger row at charge time.
- **Refunds:** every party gives back its proportional share. Stripe keeps its fee and **Pavilion absorbs it**.
- **When a spot opens on a full deal:** everyone on the waitlist is emailed and the first to book gets it.
- **Pricing:** one tier price per deal for everyone, plus optional flat-price add-ons for the same visit.
- **Money storage:** amounts are stored in cents and rates in basis points.

## Project layout

```
prisma/schema.prisma        data model (Milestone 2 fields marked "(M2)")
prisma/seed.ts              example "Gutter Day" deal
src/lib/domain/             pure business rules + unit tests
src/lib/services/           booking, charging, admin operations (DB + Stripe + email)
src/lib/payments/           Stripe adapter and mock adapter
src/lib/email/              Resend sender (logs to Outbox) and templates
src/app/d/[slug]            resident deal page, booking form, terms
src/app/b/[token]           confirmation / manage / cancel / pay / calendar
src/app/r/[token]           one-tap rating
src/app/admin               staff admin
e2e/                        Playwright test
```

## Milestone 2 hooks already in the schema

- **Stripe Connect payouts:** `stripeAccountId` on vendors, communities and management companies, plus payout status and reference fields on each ledger row.
- **Vendor job page:** `Deal.vendorToken`, `Booking.routeOrder`, `Booking.photoUrls`.
- **SMS:** `MessageLog.channel`, `Resident.smsOptIn`.
- **Recurring services:** `Deal.seriesId`. Residents are already stored as households that can carry across deals.
- **Multiple communities and deals:** already supported.
