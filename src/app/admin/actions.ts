"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { endAdminSession, passwordMatches, requireAdmin, startAdminSession } from "@/lib/auth";
import { mountainLocalToUtc, parseIsoDate } from "@/lib/dates";
import { validateRates } from "@/lib/domain/ledger";
import { parseDollars, parsePercent } from "@/lib/domain/money";
import { validateTiers } from "@/lib/domain/pricing";
import * as A from "@/lib/services/admin";
import { cancelBooking, notifyWaitlist } from "@/lib/services/booking";
import { completeAndCharge, refundBooking, retryCharge } from "@/lib/services/charging";
import { dealInclude } from "@/lib/services/deals";
import type { ActionResult } from "@/components/admin-ui";
import { setFlash } from "@/lib/flash";

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ─── Auth ───────────────────────────────────────────────────────────────────

export async function login(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!passwordMatches(String(formData.get("password") ?? ""))) {
    await new Promise((r) => setTimeout(r, 400));
    return { ok: false, message: "That password isn't right." };
  }
  await startAdminSession();
  redirect(String(formData.get("next") || "/admin"));
}

export async function logout() {
  await endAdminSession();
  redirect("/admin/login");
}

// ─── Deals ──────────────────────────────────────────────────────────────────

export type DealFormData = {
  title: string;
  slug: string;
  serviceName: string;
  communityId: string;
  vendorId: string;
  status: "draft" | "open" | "completed" | "archived";
  description: string;
  whatsIncluded: string;
  serviceDate: string;
  backupDate: string;
  arrivalWindow: string;
  signupDeadline: string; // datetime-local, Mountain time
  capacity: string;
  normalPrice: string;
  tiers: { minHomes: string; price: string }[];
  addOns: { id?: string; name: string; description: string; price: string }[];
  commission: string;
  managerShare: string;
  hoaShare: string;
  shareBasis: "price" | "commission";
  reserveFundLine: string;
  guaranteeLine: string;
  cancellationPolicy: string;
};

export type SaveDealResult = { ok: false; errors: string[] } | null;

export async function saveDeal(dealId: string | null, data: DealFormData): Promise<SaveDealResult> {
  await requireAdmin();
  const errors: string[] = [];
  const need = (v: string, label: string) => (v.trim() ? v.trim() : (errors.push(`${label} is required.`), ""));

  const title = need(data.title, "Title");
  const serviceName = need(data.serviceName, "Service");
  const slug = slugify(data.slug || data.title);
  if (!slug) errors.push("Link name is required.");
  if (!data.communityId) errors.push("Pick a community.");
  if (!data.vendorId) errors.push("Pick a vendor.");

  const serviceDate = parseIsoDate(data.serviceDate);
  const backupDate = data.backupDate ? parseIsoDate(data.backupDate) : null;
  const signupDeadline = mountainLocalToUtc(data.signupDeadline);
  if (!serviceDate) errors.push("Service date is required.");
  if (data.backupDate && !backupDate) errors.push("Backup date is invalid.");
  if (!signupDeadline) errors.push("Signup deadline is required.");
  if (serviceDate && backupDate && backupDate <= serviceDate) errors.push("The backup date should be after the service date.");
  if (serviceDate && signupDeadline && signupDeadline >= new Date(serviceDate.getTime() + 7 * 3600_000)) {
    errors.push("Signups should close before the service day.");
  }

  const capacity = Number(data.capacity);
  if (!Number.isInteger(capacity) || capacity < 1) errors.push("Max homes must be a whole number of at least 1.");
  const normalPriceCents = parseDollars(data.normalPrice);
  if (normalPriceCents == null || normalPriceCents <= 0) errors.push("Normal price must be a dollar amount.");

  const tiers = data.tiers
    .filter((t) => t.minHomes.trim() || t.price.trim())
    .map((t) => ({ minHomes: Number(t.minHomes), priceCents: parseDollars(t.price) ?? NaN }));
  if (tiers.some((t) => !Number.isFinite(t.priceCents))) errors.push("Every tier needs a dollar price.");
  else if (normalPriceCents) errors.push(...validateTiers(tiers, normalPriceCents));

  const addOns = data.addOns
    .filter((a) => a.name.trim() || a.price.trim())
    .map((a, i) => ({ id: a.id, name: a.name.trim(), description: a.description.trim(), priceCents: parseDollars(a.price), sortOrder: i }));
  if (addOns.some((a) => !a.name || a.priceCents == null)) errors.push("Every add-on needs a name and a price.");

  const rates = {
    commissionBps: parsePercent(data.commission) ?? -1,
    managerShareBps: parsePercent(data.managerShare) ?? -1,
    hoaShareBps: parsePercent(data.hoaShare) ?? -1,
    shareBasis: data.shareBasis,
  };
  errors.push(...validateRates(rates));

  const clash = await db.deal.findUnique({ where: { slug } });
  if (clash && clash.id !== dealId) errors.push(`The link name "${slug}" is taken.`);

  if (errors.length) return { ok: false, errors: [...new Set(errors)] };

  const fields = {
    title,
    slug,
    serviceName,
    communityId: data.communityId,
    vendorId: data.vendorId,
    status: data.status,
    description: data.description.trim(),
    whatsIncluded: data.whatsIncluded.trim(),
    serviceDate: serviceDate!,
    backupDate,
    arrivalWindow: data.arrivalWindow.trim(),
    signupDeadline: signupDeadline!,
    capacity,
    normalPriceCents: normalPriceCents!,
    ...rates,
    reserveFundLine: data.reserveFundLine.trim(),
    guaranteeLine: data.guaranteeLine.trim(),
    cancellationPolicy: data.cancellationPolicy.trim(),
  };

  let id = dealId;
  await db.$transaction(async (tx) => {
    if (id) {
      const existing = await tx.deal.findUniqueOrThrow({ where: { id } });
      // Moving the deadline back into the future reopens pricing.
      const reopen = existing.lockedAt && signupDeadline! > new Date();
      await tx.deal.update({ where: { id }, data: { ...fields, ...(reopen ? { lockedAt: null, lockedPriceCents: null } : {}) } });
      await tx.priceTier.deleteMany({ where: { dealId: id } });
    } else {
      id = (await tx.deal.create({ data: fields })).id;
    }
    await tx.priceTier.createMany({ data: tiers.map((t) => ({ dealId: id!, ...t })) });

    const keep = addOns.filter((a) => a.id).map((a) => a.id!);
    await tx.addOn.updateMany({ where: { dealId: id!, id: { notIn: keep } }, data: { active: false } });
    for (const a of addOns) {
      const row = { name: a.name, description: a.description, priceCents: a.priceCents!, sortOrder: a.sortOrder, active: true };
      if (a.id) await tx.addOn.update({ where: { id: a.id }, data: row });
      else await tx.addOn.create({ data: { dealId: id!, ...row } });
    }
  });

  revalidatePath("/admin", "layout");
  redirect(`/admin/deals/${id}`);
}

export async function setDealStatus(dealId: string, status: "draft" | "open" | "completed" | "archived"): Promise<ActionResult> {
  await requireAdmin();
  await db.deal.update({ where: { id: dealId }, data: { status } });
  revalidatePath(`/admin/deals/${dealId}`);
  return { ok: true, message: `Deal is now ${status}.` };
}

export async function closeSignups(dealId: string): Promise<ActionResult> {
  await requireAdmin();
  const r = await A.closeSignupsNow(dealId);
  revalidatePath(`/admin/deals/${dealId}`);
  return r;
}

export async function reschedule(dealId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const date = parseIsoDate(String(formData.get("date") ?? ""));
  if (!date) return { ok: false, message: "Pick the new date." };
  const r = await A.rescheduleDeal(dealId, date, String(formData.get("note") ?? "").trim());
  revalidatePath(`/admin/deals/${dealId}`);
  return r;
}

// ─── Bookings ───────────────────────────────────────────────────────────────

export async function chargeBooking(bookingId: string, dealId: string): Promise<ActionResult> {
  await requireAdmin();
  const r = await completeAndCharge(bookingId);
  await setFlash(r);
  revalidatePath(`/admin/deals/${dealId}`);
  return r;
}

export async function chargeSelected(dealId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const ids = formData.getAll("bookingId").map(String);
  if (!ids.length) return { ok: false, message: "Select at least one booked home." };
  let charged = 0;
  const failed: string[] = [];
  for (const id of ids) {
    const r = await completeAndCharge(id);
    if (r.ok) charged++;
    else failed.push(r.message);
  }
  const result = failed.length
    ? { ok: charged > 0, message: `Charged ${charged}. ${failed.length} didn't go through: ${[...new Set(failed)].join(" ")}` }
    : { ok: true, message: `Charged ${charged} ${charged === 1 ? "home" : "homes"}.` };
  await setFlash(result);
  revalidatePath(`/admin/deals/${dealId}`);
  return result;
}

export async function retryBookingCharge(bookingId: string, dealId: string): Promise<ActionResult> {
  await requireAdmin();
  const r = await retryCharge(bookingId);
  await setFlash(r);
  revalidatePath(`/admin/deals/${dealId}`);
  return r;
}

export async function refund(bookingId: string, dealId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const raw = String(formData.get("amount") ?? "").trim();
  const amount = raw ? parseDollars(raw) : null;
  if (raw && amount == null) return { ok: false, message: "Enter a dollar amount, or leave it blank for a full refund." };
  const r = await refundBooking(bookingId, amount);
  await setFlash(r);
  revalidatePath(`/admin/deals/${dealId}`);
  return r;
}

export async function adminCancel(bookingId: string, dealId: string): Promise<ActionResult> {
  await requireAdmin();
  const r = await cancelBooking(bookingId, "admin");
  const result = r.ok ? { ok: true, message: "Booking cancelled. The resident was emailed." } : r;
  await setFlash(result);
  revalidatePath(`/admin/deals/${dealId}`);
  return result;
}

export async function emailWaitlist(dealId: string): Promise<ActionResult> {
  await requireAdmin();
  const deal = await db.deal.findUniqueOrThrow({ where: { id: dealId }, include: dealInclude });
  await notifyWaitlist(deal);
  revalidatePath(`/admin/deals/${dealId}`);
  return { ok: true, message: "Emailed everyone on the waitlist." };
}

export async function resolveReview(reviewId: string, dealId: string, approve: boolean, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const r = await A.resolveReview(reviewId, approve, String(formData.get("address") ?? ""));
  revalidatePath(`/admin/deals/${dealId}`);
  return r;
}

export async function markPayoutsPaid(dealId: string, party: "vendor" | "manager" | "hoa"): Promise<ActionResult> {
  await requireAdmin();
  const field = { vendor: "vendorPayoutStatus", manager: "managerPayoutStatus", hoa: "hoaPayoutStatus" }[party];
  const r = await db.ledgerEntry.updateMany({ where: { dealId, [field]: "owed" }, data: { [field]: "paid" } });
  revalidatePath(`/admin/deals/${dealId}`);
  return { ok: true, message: `Marked ${r.count} ledger ${r.count === 1 ? "row" : "rows"} paid.` };
}

export async function runDailyNow(): Promise<ActionResult> {
  await requireAdmin();
  const r = await A.runDailyJobs();
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Done. Locked ${r.locked} ${r.locked === 1 ? "deal" : "deals"}, sent ${r.reminders} ${r.reminders === 1 ? "reminder" : "reminders"}.` };
}

// ─── Communities, vendors ──────────────────────────────────────────────────

const communitySchema = z.object({
  name: z.string().trim().min(2, "Community name is required"),
  city: z.string().trim().optional(),
  managementCompanyId: z.string().optional(),
  newManagementCompany: z.string().trim().optional(),
});

export async function saveCommunity(communityId: string | null, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = communitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { name, city, newManagementCompany } = parsed.data;
  let managementCompanyId = parsed.data.managementCompanyId || null;
  if (newManagementCompany) managementCompanyId = (await db.managementCompany.create({ data: { name: newManagementCompany } })).id;

  if (communityId) {
    await db.community.update({ where: { id: communityId }, data: { name, city: city || null, managementCompanyId } });
    revalidatePath(`/admin/communities/${communityId}`);
    return { ok: true, message: "Saved." };
  }
  let slug = slugify(name);
  if (await db.community.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const c = await db.community.create({ data: { name, slug, city: city || null, managementCompanyId } });
  redirect(`/admin/communities/${c.id}`);
}

export async function uploadAddresses(communityId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const file = formData.get("file");
  let csv = String(formData.get("text") ?? "");
  if (file instanceof File && file.size > 0) {
    if (file.size > 5_000_000) return { ok: false, message: "That file is over 5 MB." };
    csv = await file.text();
  }
  if (!csv.trim()) return { ok: false, message: "Choose a CSV file or paste addresses." };
  const mode = formData.get("mode") === "replace" ? "replace" : "append";
  const s = await A.importAddresses(communityId, csv, mode);
  revalidatePath(`/admin/communities/${communityId}`);
  const parts = [`Added ${s.added}`, `${s.alreadyOnList} already on the list`];
  if (s.duplicatesInFile) parts.push(`${s.duplicatesInFile} duplicates in the file`);
  if (s.deactivated) parts.push(`${s.deactivated} removed (not in the new file)`);
  if (s.skipped.length) parts.push(`${s.skipped.length} skipped: ${s.skipped.slice(0, 5).map((x) => `row ${x.row} "${x.value}"`).join(", ")}${s.skipped.length > 5 ? "…" : ""}`);
  return { ok: true, message: `${parts.join(" · ")}.` };
}

export async function setAddressActive(addressId: string, communityId: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  await db.communityAddress.update({ where: { id: addressId }, data: { active } });
  revalidatePath(`/admin/communities/${communityId}`);
  return { ok: true, message: active ? "Restored." : "Removed from the list." };
}

const vendorSchema = z.object({
  name: z.string().trim().min(2, "Vendor name is required"),
  contactName: z.string().trim().optional(),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional(),
  phone: z.string().trim().optional(),
});

export async function saveVendor(vendorId: string | null, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = vendorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const data = { name: parsed.data.name, contactName: parsed.data.contactName || null, email: parsed.data.email || null, phone: parsed.data.phone || null };
  if (vendorId) await db.vendor.update({ where: { id: vendorId }, data });
  else await db.vendor.create({ data });
  revalidatePath("/admin/vendors");
  return { ok: true, message: vendorId ? "Saved." : `Added ${data.name}.` };
}
