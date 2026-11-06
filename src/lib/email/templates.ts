// Email templates. Plain functions returning subject/html/text so they're easy to tweak.
// HTML uses tables and inline styles for email-client compatibility.

import { formatCents } from "@/lib/domain/money";
import { formatDeadline, formatServiceDate } from "@/lib/dates";

export type EmailContent = { subject: string; html: string; text: string };

const C = {
  navy: "#262D5F",
  navyDark: "#1F2552",
  stone: "#F3F1EC",
  stoneLine: "#E9E6DF",
  page: "#FAF9F6",
  ink: "#1C1B19",
  muted: "#6B6963",
};

const FONT = `'Bricolage Grotesque', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;
const HEAD = `'Fraunces', Georgia, 'Times New Roman', serif`;

export function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(opts: { preheader: string; body: string; footer?: string }): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Bricolage+Grotesque:wght@400;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.page};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td style="padding:0 4px 16px;font-family:${HEAD};font-size:20px;font-weight:700;color:${C.navy};letter-spacing:-0.02em;">Pavilion</td></tr>
    <tr><td style="background:#ffffff;border:1px solid ${C.stoneLine};border-radius:16px;padding:28px 24px;font-family:${FONT};font-size:16px;line-height:1.55;color:${C.ink};">
      ${opts.body}
    </td></tr>
    <tr><td style="padding:16px 8px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};">
      ${opts.footer ?? ""}
      Pavilion books vetted local service companies for HOA communities. The service company performs the work.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

const h1 = (s: string) => `<h1 style="margin:0 0 12px;font-family:${HEAD};font-size:24px;line-height:1.2;font-weight:700;color:${C.ink};letter-spacing:-0.02em;">${s}</h1>`;
const p = (s: string) => `<p style="margin:0 0 14px;">${s}</p>`;
const small = (s: string) => `<p style="margin:0 0 10px;font-size:13px;color:${C.muted};">${s}</p>`;

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;"><tr><td style="border-radius:999px;background:${C.navy};">
  <a href="${esc(href)}" style="display:inline-block;padding:13px 24px;font-family:${FONT};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${esc(label)}</a>
  </td></tr></table>`;
}

function details(rows: [string, string][]): string {
  const tr = rows
    .map(
      ([k, v]) => `<tr>
      <td style="padding:8px 12px 8px 0;font-size:14px;color:${C.muted};vertical-align:top;white-space:nowrap;">${esc(k)}</td>
      <td style="padding:8px 0;font-size:15px;color:${C.ink};vertical-align:top;">${v}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 16px;border-top:1px solid ${C.stoneLine};border-bottom:1px solid ${C.stoneLine};">${tr}</table>`;
}

function callout(s: string): string {
  return `<div style="margin:16px 0;padding:14px 16px;background:${C.stone};border-radius:12px;font-size:15px;">${s}</div>`;
}

function toText(lines: (string | null | undefined | false)[]): string {
  return lines.filter((l) => l !== null && l !== undefined && l !== false).join("\n");
}

// ─── Shared context ─────────────────────────────────────────────────────────

export type DealContext = {
  title: string;
  serviceName: string;
  vendorName: string;
  communityName: string;
  serviceDate: Date;
  backupDate: Date | null;
  arrivalWindow: string;
  signupDeadline: Date;
  normalPriceCents: number;
  reserveFundLine: string; // already filled in with the community name
  guaranteeLine: string;
  dealUrl: string;
  referralCreditCents: number; // 0 = no referral reward on this deal
  referralCreditCapCents: number;
};

type Referral = { referrals: number; earnedCents: number; left: number };

/** "Get $3 off your own job for every neighbor who books with your link (up to $15)." */
function referralPitch(d: DealContext): string | null {
  if (d.referralCreditCents <= 0) return null;
  return `Get ${formatCents(d.referralCreditCents)} off your own job for every neighbor who books with your link (up to ${formatCents(d.referralCreditCapCents)}).`;
}

export type BookingContext = {
  name: string;
  address: string;
  manageUrl: string;
  shareUrl: string;
  addOns: { name: string; priceCents: number }[];
};

const firstName = (name: string) => esc(name.trim().split(/\s+/)[0] || "there");
const when = (d: DealContext) => `${formatServiceDate(d.serviceDate)}${d.arrivalWindow ? `, ${esc(d.arrivalWindow)}` : ""}`;

function addOnRows(b: BookingContext): [string, string][] {
  return b.addOns.map((a) => ["Add-on", `${esc(a.name)} (+${formatCents(a.priceCents)})`]);
}

// ─── Templates ──────────────────────────────────────────────────────────────

export function bookingConfirmed(d: DealContext, b: BookingContext, priceCents: number, next: { homesNeeded: number; priceCents: number } | null): EmailContent {
  const subject = `You're booked: ${d.title} on ${formatServiceDate(d.serviceDate, "short")}`;
  const priceLine = next
    ? `Today's price is <strong>${formatCents(priceCents)}</strong> (normally ${formatCents(d.normalPriceCents)}). ${next.homesNeeded} more ${next.homesNeeded === 1 ? "home" : "homes"} and it drops to ${formatCents(next.priceCents)} for everyone.`
    : `You're getting the lowest price: <strong>${formatCents(priceCents)}</strong> (normally ${formatCents(d.normalPriceCents)}).`;
  const html = layout({
    preheader: `Your card is saved, not charged. ${d.vendorName} will be there ${formatServiceDate(d.serviceDate)}.`,
    body: [
      h1(`You're booked, ${firstName(b.name)}`),
      p(`${esc(d.vendorName)} will take care of your ${esc(d.serviceName.toLowerCase())} on <strong>${when(d)}</strong>.`),
      details([
        ["Service", esc(d.serviceName)],
        ["Date", `${formatServiceDate(d.serviceDate)}${d.backupDate ? `<br><span style="color:${C.muted};font-size:13px;">Weather backup: ${formatServiceDate(d.backupDate)}</span>` : ""}`],
        ["Address", esc(b.address)],
        ["Pro", esc(d.vendorName)],
        ...addOnRows(b),
      ]),
      callout(`${priceLine} The price can only go down. It locks when signups close ${formatDeadline(d.signupDeadline)}.`),
      p(`<strong>Your card is saved, not charged.</strong> We charge it only after the job is done.`),
      p(`<strong>Know a neighbor who'd want this?</strong> Every home that books lowers the price for everyone, you included.${referralPitch(d) ? ` And you ${referralPitch(d)!.replace(/^Get/, "get")}` : ""}`),
      button(b.shareUrl, "Share with neighbors"),
      small(`Plans change? <a href="${esc(b.manageUrl)}" style="color:${C.navy};">View or cancel your booking</a> any time before signups close.`),
      small(esc(d.reserveFundLine)),
    ].join(""),
  });
  const text = toText([
    `You're booked, ${b.name.split(" ")[0]}.`,
    `${d.vendorName} will take care of your ${d.serviceName.toLowerCase()} on ${formatServiceDate(d.serviceDate)}.`,
    d.backupDate && `Weather backup: ${formatServiceDate(d.backupDate)}`,
    `Address: ${b.address}`,
    "",
    priceLine.replace(/<[^>]+>/g, ""),
    "Your card is saved, not charged. We charge it only after the job is done.",
    "",
    referralPitch(d),
    `Share with neighbors: ${b.shareUrl}`,
    `View or cancel: ${b.manageUrl}`,
    "",
    d.reserveFundLine,
  ]);
  return { subject, html, text };
}

export function tierUnlocked(d: DealContext, b: BookingContext, homesBooked: number, newPriceCents: number, next: { homesNeeded: number; priceCents: number } | null): EmailContent {
  const subject = `Price drop: ${d.title} is now ${formatCents(newPriceCents)}`;
  const nextLine = next ? `${next.homesNeeded} more ${next.homesNeeded === 1 ? "home" : "homes"} and it drops again to ${formatCents(next.priceCents)}.` : `That's the lowest price for this service day.`;
  const html = layout({
    preheader: `${homesBooked} homes in ${d.communityName} have booked. Your price just dropped.`,
    body: [
      h1(`Your price just dropped to ${formatCents(newPriceCents)}`),
      p(`${homesBooked} homes in ${esc(d.communityName)} have booked ${esc(d.title)}, so the price dropped for everyone, including you. ${nextLine}`),
      ...(referralPitch(d) ? [p(esc(referralPitch(d)!))] : []),
      button(b.shareUrl, "Share with neighbors"),
      small(`Nothing to do on your end. You'll pay the final price after the job on ${formatServiceDate(d.serviceDate)}.`),
    ].join(""),
  });
  const text = toText([
    `Your price just dropped to ${formatCents(newPriceCents)}.`,
    `${homesBooked} homes in ${d.communityName} have booked ${d.title}. ${nextLine}`,
    `Share: ${b.shareUrl}`,
  ]);
  return { subject, html, text };
}

export function signupsClosed(d: DealContext, b: BookingContext, finalPriceCents: number, referral?: Referral): EmailContent {
  const credit = referral?.earnedCents ?? 0;
  const total = Math.max(50, finalPriceCents + b.addOns.reduce((s, a) => s + a.priceCents, 0) - credit);
  const subject = `Signups closed. Your final price: ${formatCents(finalPriceCents)}`;
  const html = layout({
    preheader: `${d.title} is ${formatServiceDate(d.serviceDate)}. Your price is locked.`,
    body: [
      h1(`Your price is locked at ${formatCents(finalPriceCents)}`),
      p(`Signups for ${esc(d.title)} are closed. Everyone in ${esc(d.communityName)} pays the same final price.`),
      details([
        ["Date", when(d)],
        ["Address", esc(b.address)],
        ["Service", `${formatCents(finalPriceCents)} <span style="color:${C.muted};text-decoration:line-through;font-size:13px;">${formatCents(d.normalPriceCents)}</span>`],
        ...addOnRows(b),
        ...(credit ? [["Neighbor referral credit", `−${formatCents(credit)} <span style="color:${C.muted};font-size:13px;">(${referral!.referrals} ${referral!.referrals === 1 ? "neighbor" : "neighbors"})</span>`] as [string, string]] : []),
        ["Total after the job", `<strong>${formatCents(total)}</strong>`],
      ]),
      small(`We'll send a reminder the day before. Your card is charged only after the work is done.`),
    ].join(""),
  });
  const text = toText([`Your price is locked at ${formatCents(finalPriceCents)}.`, `Date: ${formatServiceDate(d.serviceDate)}`, `Total after the job: ${formatCents(total)}`]);
  return { subject, html, text };
}

export function reminder(d: DealContext, b: BookingContext, notes: string): EmailContent {
  const subject = `Tomorrow: ${d.title} at your home`;
  const html = layout({
    preheader: `${d.vendorName} will be at ${b.address} tomorrow.`,
    body: [
      h1(`See you tomorrow`),
      p(`${esc(d.vendorName)} will be at your home <strong>${when(d)}</strong>. You don't need to be home.`),
      details([
        ["Address", esc(b.address)],
        ["Your notes for the crew", notes ? esc(notes) : `<span style="color:${C.muted};">None</span>`],
        ...addOnRows(b),
      ]),
      callout(`Please unlock side gates and keep pets inside while the crew is there.`),
      small(`If the weather turns, we'll email you the new date${d.backupDate ? ` (backup: ${formatServiceDate(d.backupDate)})` : ""}.`),
    ].join(""),
  });
  const text = toText([`See you tomorrow.`, `${d.vendorName} will be at ${b.address} ${formatServiceDate(d.serviceDate)}.`, `Please unlock side gates and keep pets inside.`]);
  return { subject, html, text };
}

export function rescheduled(d: DealContext, b: BookingContext, previousDate: Date, note: string): EmailContent {
  const subject = `${d.title} moved to ${formatServiceDate(d.serviceDate, "short")}`;
  const html = layout({
    preheader: `New date: ${formatServiceDate(d.serviceDate)}. Nothing else changes.`,
    body: [
      h1(`New date: ${formatServiceDate(d.serviceDate)}`),
      p(`${esc(d.title)} is moving from ${formatServiceDate(previousDate)} to <strong>${when(d)}</strong>.${note ? ` ${esc(note)}` : ""}`),
      p(`Your booking and price stay the same. You don't need to do anything.`),
      small(`Can't make the new date? <a href="${esc(b.manageUrl)}" style="color:${C.navy};">View your booking</a> or reply to this email.`),
    ].join(""),
  });
  const text = toText([`New date: ${formatServiceDate(d.serviceDate)}.`, `${d.title} is moving from ${formatServiceDate(previousDate)}.${note ? ` ${note}` : ""}`, "Your booking and price stay the same."]);
  return { subject, html, text };
}

export function receipt(d: DealContext, b: BookingContext, opts: { basePriceCents: number; referralCreditCents: number; totalCents: number; card: string; ratingUrl: (score: number) => string }): EmailContent {
  const subject = `Receipt: ${d.title}, ${formatCents(opts.totalCents)}`;
  const stars = [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<td style="padding:0 4px;"><a href="${esc(opts.ratingUrl(n))}" style="display:inline-block;width:44px;height:44px;line-height:44px;text-align:center;border-radius:12px;background:${C.stone};color:${C.navy};font-family:${HEAD};font-size:18px;font-weight:700;text-decoration:none;">${n}</a></td>`,
    )
    .join("");
  const html = layout({
    preheader: `Paid ${formatCents(opts.totalCents)}. How did ${d.vendorName} do?`,
    body: [
      h1(`Thanks, ${firstName(b.name)}. You're all set.`),
      p(`${esc(d.vendorName)} finished your ${esc(d.serviceName.toLowerCase())}. Here's your receipt.`),
      details([
        [d.serviceName, `${formatCents(opts.basePriceCents)} <span style="color:${C.muted};text-decoration:line-through;font-size:13px;">${formatCents(d.normalPriceCents)}</span>`],
        ...b.addOns.map((a): [string, string] => [a.name, formatCents(a.priceCents)]),
        ...(opts.referralCreditCents ? [["Neighbor referral credit", `−${formatCents(opts.referralCreditCents, { showZeroCents: false })}`] as [string, string]] : []),
        ["Total charged", `<strong>${formatCents(opts.totalCents)}</strong>`],
        ["Card", esc(opts.card)],
        ["Address", esc(b.address)],
      ]),
      `<p style="margin:20px 0 8px;font-weight:600;">How did ${esc(d.vendorName)} do?</p>`,
      `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 6px -4px;"><tr>${stars}</tr></table>`,
      small(`1 = poor, 5 = excellent. One tap is all it takes.`),
      callout(esc(d.guaranteeLine) + ` Just reply to this email.`),
      `<p style="margin:22px 0 4px;font-weight:600;">Want this again next time?</p>`,
      p(`Save your spot and we'll email you as soon as the next ${esc(d.title)} is scheduled. Nothing is booked or charged until you confirm.`),
      button(`${b.manageUrl}#next-time`, "Save my spot for next time"),
      small(esc(d.reserveFundLine)),
    ].join(""),
  });
  const text = toText([
    `Thanks, ${b.name.split(" ")[0]}. You're all set.`,
    `${d.serviceName}: ${formatCents(opts.basePriceCents)}`,
    ...b.addOns.map((a) => `${a.name}: ${formatCents(a.priceCents)}`),
    opts.referralCreditCents ? `Neighbor referral credit: -${formatCents(opts.referralCreditCents)}` : null,
    `Total charged: ${formatCents(opts.totalCents)} (${opts.card})`,
    "",
    `How did ${d.vendorName} do? Tap a rating (1 = poor, 5 = excellent):`,
    ...[1, 2, 3, 4, 5].map((n) => `${n}: ${opts.ratingUrl(n)}`),
    d.guaranteeLine,
    "",
    `Want this again next time? Save your spot: ${b.manageUrl}#next-time`,
  ]);
  return { subject, html, text };
}

export function paymentFailed(d: DealContext, b: BookingContext, amountCents: number, payUrl: string, needsAuth: boolean): EmailContent {
  const subject = `Action needed: payment for ${d.title}`;
  const reason = needsAuth ? `Your bank wants you to approve this payment.` : `Your card didn't go through.`;
  const html = layout({
    preheader: `${reason} It takes a minute to fix.`,
    body: [
      h1(`One more step to pay for ${esc(d.title)}`),
      p(`${esc(d.vendorName)} finished the job at ${esc(b.address)}. ${reason} You can pay securely with the button below.`),
      button(payUrl, `Pay ${formatCents(amountCents)}`),
      small(`Questions? Just reply to this email.`),
    ].join(""),
  });
  const text = toText([`One more step to pay for ${d.title}.`, reason, `Pay ${formatCents(amountCents)}: ${payUrl}`]);
  return { subject, html, text };
}

export function refundIssued(d: DealContext, b: BookingContext, amountCents: number, full: boolean): EmailContent {
  const subject = `Refund issued: ${formatCents(amountCents)} for ${d.title}`;
  const html = layout({
    preheader: `Your refund is on its way.`,
    body: [
      h1(`We've refunded ${formatCents(amountCents)}`),
      p(`We issued a ${full ? "full" : "partial"} refund of <strong>${formatCents(amountCents)}</strong> for ${esc(d.title)} at ${esc(b.address)}. It usually shows up on your statement in 5–10 business days.`),
      small(`Questions? Just reply to this email.`),
    ].join(""),
  });
  return { subject, html, text: `We refunded ${formatCents(amountCents)} for ${d.title}. It usually shows up in 5-10 business days.` };
}

export function bookingCancelled(d: DealContext, b: BookingContext): EmailContent {
  const subject = `Cancelled: ${d.title}`;
  const html = layout({
    preheader: `You won't be charged.`,
    body: [
      h1(`Your booking is cancelled`),
      p(`We cancelled ${esc(d.title)} for ${esc(b.address)}. Your card won't be charged.`),
      p(`Changed your mind? You can book again before signups close ${formatDeadline(d.signupDeadline)}.`),
      button(d.dealUrl, "Book again"),
    ].join(""),
  });
  return { subject, html, text: `Your ${d.title} booking for ${b.address} is cancelled. You won't be charged. Book again: ${d.dealUrl}` };
}

export function waitlistJoined(d: DealContext, name: string): EmailContent {
  const subject = `You're on the waitlist for ${d.title}`;
  const html = layout({
    preheader: `We'll email you if a spot opens.`,
    body: [
      h1(`You're on the waitlist`),
      p(`Hi ${firstName(name)}, ${esc(d.title)} on ${formatServiceDate(d.serviceDate)} is full right now. If a spot opens before signups close, we'll email you right away.`),
    ].join(""),
  });
  return { subject, html, text: `You're on the waitlist for ${d.title}. We'll email you if a spot opens.` };
}

export function spotOpened(d: DealContext, name: string, priceCents: number): EmailContent {
  const subject = `A spot opened up: ${d.title}`;
  const html = layout({
    preheader: `First to book gets it.`,
    body: [
      h1(`A spot just opened`),
      p(`Hi ${firstName(name)}, a spot opened for ${esc(d.title)} on ${formatServiceDate(d.serviceDate)} at <strong>${formatCents(priceCents)}</strong>. We've told everyone on the waitlist, so the first neighbor to book gets it.`),
      button(d.dealUrl, "Book the spot"),
      small(`Signups close ${formatDeadline(d.signupDeadline)}.`),
    ].join(""),
  });
  return { subject, html, text: `A spot opened for ${d.title}. First to book gets it: ${d.dealUrl}` };
}

/**
 * To a home that tapped "Save my spot for next time" after an earlier service day.
 * `bookUrl` opens the new deal with their name, contact and address already filled in.
 */
export function savedSpotOpen(d: DealContext, name: string, priceCents: number, bookUrl: string): EmailContent {
  const subject = `Your spot is saved: ${d.title} on ${formatServiceDate(d.serviceDate, "short")}`;
  const html = layout({
    preheader: `You asked us to save your spot. Confirm it in a minute.`,
    body: [
      h1(`The next ${esc(d.title)} is on`),
      p(`Hi ${firstName(name)}, you asked us to save your spot after the last one. ${esc(d.vendorName)} is coming back to ${esc(d.communityName)} on <strong>${formatServiceDate(d.serviceDate)}</strong>${d.arrivalWindow ? `, ${esc(d.arrivalWindow)}` : ""}.`),
      details([
        ["Group price today", `<strong>${formatCents(priceCents)}</strong> <span style="color:${C.muted};text-decoration:line-through;font-size:13px;">${formatCents(d.normalPriceCents)}</span>`],
        ["Signups close", formatDeadline(d.signupDeadline)],
      ]),
      p(`Your details are already filled in. Just confirm your card. You're charged after the job, same as last time.`),
      button(bookUrl, "Confirm my spot"),
      small(`Not this time? Ignore this email. You won't be booked or charged.`),
    ].join(""),
  });
  return { subject, html, text: toText([`Hi ${name.trim().split(/\s+/)[0] || "there"}, the next ${d.title} is on ${formatServiceDate(d.serviceDate)}. You asked us to save your spot.`, `Group price today: ${formatCents(priceCents)}. Signups close ${formatDeadline(d.signupDeadline)}.`, `Confirm your spot (details already filled in): ${bookUrl}`, "Not this time? Ignore this email. You won't be booked or charged."]) };
}

export function reviewReceived(d: DealContext, name: string, address: string): EmailContent {
  return {
    subject: `We're checking your address for ${d.title}`,
    html: layout({
      preheader: `We'll get back to you soon.`,
      body: [
        h1(`Thanks, we're on it`),
        p(`Hi ${firstName(name)}, we couldn't find <strong>${esc(address)}</strong> on ${esc(d.communityName)}'s address list. We'll check with the community and email you soon.`),
      ].join(""),
    }),
    text: `We couldn't find ${address} on ${d.communityName}'s address list. We'll check and email you soon.`,
  };
}

export function reviewApproved(d: DealContext, name: string, address: string): EmailContent {
  return {
    subject: `You're approved for ${d.title}`,
    html: layout({
      preheader: `Your address is on the list. Book any time before signups close.`,
      body: [
        h1(`You're good to go`),
        p(`Hi ${firstName(name)}, we added ${esc(address)} to ${esc(d.communityName)}'s list. You can book now.`),
        button(d.dealUrl, "Finish booking"),
        small(`Signups close ${formatDeadline(d.signupDeadline)}.`),
      ].join(""),
    }),
    text: `We added ${address} to the list. Finish booking: ${d.dealUrl}`,
  };
}

export function reviewRejected(d: DealContext, name: string, address: string): EmailContent {
  return {
    subject: `About your request for ${d.title}`,
    html: layout({
      preheader: `This service day is only for ${d.communityName} homes.`,
      body: [
        h1(`We couldn't add your address`),
        p(`Hi ${firstName(name)}, ${esc(d.title)} is only open to homes in ${esc(d.communityName)}, and we couldn't confirm ${esc(address)} is one of them. If you think that's a mistake, just reply to this email.`),
      ].join(""),
    }),
    text: `We couldn't confirm ${address} is in ${d.communityName}. Reply if that's a mistake.`,
  };
}

export function adminReviewAlert(d: DealContext, r: { name: string; email: string; phone: string; address: string }, adminUrl: string): EmailContent {
  return {
    subject: `[Pavilion] Address review: ${r.address}`,
    html: layout({
      preheader: `${r.name} wants to book ${d.title}.`,
      body: [
        h1(`Address review requested`),
        details([["Deal", esc(d.title)], ["Name", esc(r.name)], ["Email", esc(r.email)], ["Phone", esc(r.phone)], ["Address", esc(r.address)]]),
        button(adminUrl, "Review in admin"),
      ].join(""),
    }),
    text: `${r.name} (${r.email}, ${r.phone}) requested review for ${r.address} on ${d.title}. ${adminUrl}`,
  };
}

export function referralEarned(d: DealContext, b: BookingContext, r: Referral): EmailContent {
  const capped = r.left === 0;
  const subject = `A neighbor booked with your link: ${formatCents(r.earnedCents)} off your ${d.title}`;
  const more = capped
    ? `That's the most you can earn for this service day. Thank you for spreading the word!`
    : `Every neighbor who books with your link takes another ${formatCents(d.referralCreditCents)} off, up to ${formatCents(d.referralCreditCapCents)}.`;
  const html = layout({
    preheader: `You've earned ${formatCents(r.earnedCents)} off so far.`,
    body: [
      h1(`You just earned ${formatCents(d.referralCreditCents)} off`),
      p(`A neighbor booked ${esc(d.title)} with your link. You now have <strong>${formatCents(r.earnedCents)} off</strong> your own job, taken off when your card is charged after the work is done.`),
      callout(more),
      ...(capped ? [] : [button(b.shareUrl, "Share your link again")]),
      small(`Credit counts for neighbors who are still booked when we charge after the job.`),
    ].join(""),
  });
  const text = toText([
    `A neighbor booked ${d.title} with your link. You now have ${formatCents(r.earnedCents)} off your own job.`,
    more,
    capped ? null : `Your link: ${b.shareUrl}`,
  ]);
  return { subject, html, text };
}

// ─── Vendor ─────────────────────────────────────────────────────────────────

export type RouteStop = { stop: number; address: string; name: string; phone: string; addOns: string[]; notes: string };

export function vendorRoute(d: DealContext, stops: RouteStop[], opts: { contactName: string | null; updated: boolean }): EmailContent {
  const n = stops.length;
  const homes = `${n} ${n === 1 ? "home" : "homes"}`;
  const subject = `${opts.updated ? "Updated route list" : "Route list"}: ${d.title} on ${formatServiceDate(d.serviceDate, "short")} (${homes})`;
  const addOnCounts = new Map<string, number>();
  for (const s of stops) for (const a of s.addOns) addOnCounts.set(a, (addOnCounts.get(a) ?? 0) + 1);

  const rows = stops
    .map(
      (s) => `<tr>
      <td style="padding:10px 10px 10px 0;vertical-align:top;font-family:${HEAD};font-size:16px;font-weight:700;color:${C.navy};width:28px;">${s.stop}</td>
      <td style="padding:10px 0;vertical-align:top;border-top:1px solid ${C.stoneLine};">
        <div style="font-weight:600;">${esc(s.address)}</div>
        <div style="font-size:14px;color:${C.muted};">${esc(s.name)} · <a href="tel:${esc(s.phone.replace(/\D/g, ""))}" style="color:${C.muted};">${esc(s.phone)}</a></div>
        ${s.addOns.length ? `<div style="font-size:14px;color:${C.navy};">+ ${esc(s.addOns.join(", "))}</div>` : ""}
        ${s.notes ? `<div style="font-size:14px;margin-top:2px;">Note: ${esc(s.notes)}</div>` : ""}
      </td></tr>`,
    )
    .join("");

  const html = layout({
    preheader: `${homes} in ${d.communityName} on ${formatServiceDate(d.serviceDate)}.`,
    body: [
      h1(opts.updated ? `Updated route for ${formatServiceDate(d.serviceDate, "short")}` : `Your route for ${formatServiceDate(d.serviceDate, "short")}`),
      p(
        `${opts.contactName ? `Hi ${esc(opts.contactName.split(" ")[0])}, ` : ""}${
          opts.updated ? `here's the latest list for ${esc(d.title)} in ${esc(d.communityName)}. It replaces the one we sent before.` : `signups for ${esc(d.title)} in ${esc(d.communityName)} are closed. Here's every home that booked.`
        }`,
      ),
      details([
        ["Date", when(d)],
        ...(d.backupDate ? [["Rain date", formatServiceDate(d.backupDate)] as [string, string]] : []),
        ["Homes", `<strong>${n}</strong>`],
        ...[...addOnCounts].map(([name, count]) => [name, `${count}`] as [string, string]),
      ]),
      n ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:4px 0 16px;">${rows}</table>` : p(`No homes are booked.`),
      callout(`<strong>You don't collect payment.</strong> Let us know as homes are finished and Pavilion charges each resident's saved card. Residents get a reminder the day before.`),
      small(`The same list is attached as a spreadsheet, in driving order. Resident names and phone numbers are only for this job. Reply to this email if anything looks off.`),
    ].join(""),
  });
  const text = toText([
    subject,
    "",
    `Date: ${formatServiceDate(d.serviceDate)}${d.arrivalWindow ? `, ${d.arrivalWindow}` : ""}`,
    d.backupDate ? `Rain date: ${formatServiceDate(d.backupDate)}` : null,
    "",
    ...stops.map((s) => `${s.stop}. ${s.address} | ${s.name} ${s.phone}${s.addOns.length ? ` | + ${s.addOns.join(", ")}` : ""}${s.notes ? ` | Note: ${s.notes}` : ""}`),
    "",
    "You don't collect payment. Let us know as homes are finished and Pavilion charges each resident's saved card.",
  ]);
  return { subject, html, text };
}
