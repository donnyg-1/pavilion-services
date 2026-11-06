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

With no Stripe, Resend or Twilio keys, the app runs in **mock mode**:

- **Payments:** a "test wallet" button stands in for Apple Pay / Google Pay, and three test cards stand in for Stripe's card field: one that succeeds, one that gets declined later, and one that needs bank approval later.
- **Email:** emails go to the admin **Outbox** (`/admin/outbox`), where you can read each one exactly as a resident would see it.
- **Texts:** texts are saved to the same Outbox, marked "Text".

The admin header always shows which mode you're in.

### Click through the whole flow

1. Open `/d/gutter-day?src=flyer`. The seed data has 3 homes booked, so it shows "2 more → $149".
2. Tap **Book with test wallet**. That's the one-tap path Apple Pay and Google Pay users get.
3. Or fill in the form: type `1300 nor` in the street field and pick `1300 N 500 E` from the suggestions. Try `999 Nowhere St` to see "Not on the list? Request review".
4. On the confirmation page, copy the share link and book another home with it. That booking counts as a neighbor referral. Wallet bookers can add a gate code there too.
5. Book a few more homes and choose the "declined later" and "bank approval needed later" test cards for some of them.
6. Admin → Gutter Day → **Close signups now**. This locks the price and emails everyone their final price.
7. Bookings tab → select all → **Complete & charge selected**. Successful charges send receipts. Failed charges email the resident a payment link (open it from the Outbox).
8. Refund one booking, then look at the **Ledger** tab and export it.
9. Overview → **Move & notify** to reschedule everyone to the rain date.
10. Click a 1–5 link in a receipt email to leave a rating.

## Tests

```bash
npm test                    # unit tests: pricing tiers, capacity/waitlist, address matching, charge/ledger math, CSV
npm run db:reset            # fresh seed data (the e2e test needs signups open)
npm run test:e2e            # browser tests: one-tap wallet booking; form booking → close signups → charge → ledger (mock mode)
```

## Real Stripe (test mode)

1. In the Stripe dashboard (test mode), copy the secret key into `STRIPE_SECRET_KEY` and the publishable key into `STRIPE_PUBLISHABLE_KEY`.
2. Forward webhooks locally with the [Stripe CLI](https://stripe.com/docs/stripe-cli):
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Put the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`. The browser also confirms bookings directly, so the webhook is a safety net.
3. Reseed. Sample bookings are only created in mock mode, because they don't have real saved cards.
4. Test cards go straight into the card field on the deal page: `4242 4242 4242 4242` (succeeds), `4000 0027 6000 3184` (needs authentication when charged later), `4000 0000 0000 0341` (saves fine, declined when charged later).
5. **Apple Pay / Google Pay:** the button appears automatically on phones and browsers with a saved wallet. Apple Pay also needs the site's domain registered in the Stripe dashboard (Settings → Payment method domains). That works with a `*.vercel.app` address for the pilot. Google Pay needs no setup.

How payments work:

- **Booking:** the browser saves the card with Stripe's embedded fields (a SetupIntent, usage off-session). Residents never leave the page and nothing is charged.
- **Mark complete:** an off-session PaymentIntent charges the locked price plus add-ons.
- **Declines and authentication:** the resident is emailed a link that opens a fresh Stripe Checkout payment page.
- **Ledger:** uses Stripe's actual processing fee from the balance transaction. In mock mode the fee is estimated at 2.9% + 30¢.

## Email (Resend)

Set `RESEND_API_KEY` and `EMAIL_FROM`. Until you verify a sending domain in Resend, you can only send to your own address from `onboarding@resend.dev`. Every email is still saved to the Outbox either way.

## Vendors

Each vendor has an onboarding checklist under **Vendors**:
- insurance expiration date, from their certificate of insurance
- the date they signed the vendor agreement
- whether you've received their bank details

Signups can't open for a deal until all three are on file and the insurance covers the service day. You get a warning if the insurance lapses before the rain date.

When signups close, the vendor gets an email with the route list. Homes are in driving order, with names, phone numbers, add-ons and crew notes, and the same list is attached as a CSV. Staff can resend it from the Bookings tab, for example after a cancellation. It's also re-sent automatically when the service day moves.

## Save my spot for next time

After the job, the booking page, the rating page and the receipt email offer **Save my spot for next time**. It records interest only (`Booking.nextTimeAt`): nothing is booked or charged, and the resident can undo it.

When the next service day for the same service and community is open, its Overview tab shows **Saved spots for next time** with an **Email N saved homes** button. Each home gets one email (deduped per deal) linking to the new deal with `?src=saved_spot&again=<their last booking token>`, which fills in their name, contact and address. They add a card and book as usual, and the booking counts under "Saved spot (repeat)" in the sources table. Only a resident's most recent finished job counts, so someone who came back and didn't save again isn't emailed.

## Texts (Twilio)

Residents who tick "Text me when the crew is on the way" get:

| Text | When |
| --- | --- |
| Booking confirmed | Right after they book. Includes "Reply STOP to opt out." |
| Reminder | The day before, from the daily job. Only sent 8am to 9pm Mountain. |
| Crew on the way | When staff press "Text: crew on the way" on a booking in the admin. |
| Date moved | When staff move the service day (weather). |
| Card didn't go through | With the secure payment link, when an off-session charge fails. |

Residents can turn texts off on their booking page or by replying STOP.

To send for real:

1. Create a Twilio account, buy a local number, and create a **Messaging Service** with the number in it.
2. Register for **A2P 10DLC** (brand + "Account notifications" campaign). US carriers block unregistered texts from local numbers. Approval usually takes a few days to a few weeks. Use the booking form's opt-in box and the terms page's "Text messages" section as the opt-in proof.
3. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_MESSAGING_SERVICE_SID` (or `TWILIO_FROM` with a plain number).
4. In the Messaging Service, set the incoming message webhook to `APP_URL/api/twilio/inbound`. Keep Twilio's default opt-out handling on: it sends the STOP/HELP replies and blocks texts to numbers that opted out. The webhook keeps `Resident.smsOptIn` in sync.

Each text costs about a cent (plus carrier fees), and most are one segment. They're written in plain ASCII so they don't switch to the pricier Unicode encoding.

## Deploy (Vercel)

1. Import the GitHub repo in Vercel. Set `ADMIN_PASSWORD`, `SESSION_SECRET` (32+ characters) and `CRON_SECRET`.
2. Under the project's **Storage** tab, create a Neon Postgres database and connect it. That sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. Redeploy.
3. Each deploy runs `npm run vercel-build`, which applies migrations, seeds the sample "Gutter Day" deal if it isn't there yet, and builds. `APP_URL` defaults to the project's production address. Set it only for a custom domain.
4. `vercel.json` schedules `/api/cron/daily` once a day (16:00 UTC, which is 9–10am Mountain). It sends the day-before reminders and locks any deal whose deadline passed. Deadlines also lock on the next page view, so nothing depends on cron timing. Vercel sends `CRON_SECRET` automatically.
5. For real Stripe test payments, see "Real Stripe" above: add the keys, a webhook at `https://<your-app>/api/stripe/webhook` for `setup_intent.succeeded` and `checkout.session.completed`, and register the domain under Settings → Payment method domains for Apple Pay.

## How the rules are implemented

| Rule | Where |
|---|---|
| Price only drops; tiers unlock off the **peak** booked count, so cancellations never raise it | `src/lib/domain/pricing.ts` |
| Tier locks at the deadline (`lockDealIfDue`, idempotent, runs on page views and cron) | `src/lib/services/deals.ts` |
| Capacity, waitlist, and holding a spot during card entry (row lock per deal, so the last spot can't be double-booked) | `src/lib/domain/capacity.ts`, `src/lib/services/booking.ts` |
| Address normalization for Utah grid and named streets, plus suggestions from the community list (`/api/addresses`, only after a house number is typed, max 5 results) | `src/lib/domain/address.ts` |
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
src/lib/sms/                Twilio sender (logs to Outbox), text templates, signature check
src/app/d/[slug]            resident deal page, booking form (wallet, card, address suggestions), terms
src/app/b/[token]           confirmation / manage / cancel / pay / calendar
src/app/r/[token]           one-tap rating
src/app/admin               staff admin
e2e/                        Playwright test
```

## Milestone 2 hooks already in the schema

- **Stripe Connect payouts:** `stripeAccountId` on vendors, communities and management companies, plus payout status and reference fields on each ledger row.
- **Vendor job page:** `Deal.vendorToken`, `Booking.routeOrder`, `Booking.photoUrls`.
- **Recurring services:** `Deal.seriesId`. Residents are already stored as households that can carry across deals.
- **Multiple communities and deals:** already supported.
