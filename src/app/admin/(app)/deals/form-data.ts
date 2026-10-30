import type { DealFormData } from "../../actions";
import { addDays, isoDate, mountainToday, utcToMountainLocal } from "@/lib/dates";
import type { DealFull } from "@/lib/services/deals";

const dollars = (cents: number) => (cents / 100).toFixed(cents % 100 ? 2 : 0);
const percent = (bps: number) => String(bps / 100);

export function blankDealForm(): DealFormData {
  const service = addDays(mountainToday(), 21);
  return {
    title: "",
    slug: "",
    serviceName: "",
    communityId: "",
    vendorId: "",
    status: "draft",
    description: "",
    whatsIncluded: "",
    serviceDate: service,
    backupDate: addDays(service, 7),
    arrivalWindow: "8am–5pm",
    signupDeadline: `${addDays(service, -5)}T20:00`,
    capacity: "40",
    normalPrice: "",
    tiers: [
      { minHomes: "1", price: "" },
      { minHomes: "5", price: "" },
      { minHomes: "10", price: "" },
    ],
    addOns: [],
    commission: "15",
    managerShare: "4",
    hoaShare: "3",
    shareBasis: "price",
    referralCredit: "5",
    referralCap: "25",
    reserveFundLine: "A share of every booking goes to {community}'s reserve fund.",
    guaranteeLine: "If you're not happy, the crew comes back to make it right, or you get your money back.",
    cancellationPolicy: "Cancel free anytime before signups close. After that, contact us and we'll work it out.",
  };
}

export function dealToForm(d: DealFull): DealFormData {
  return {
    title: d.title,
    slug: d.slug,
    serviceName: d.serviceName,
    communityId: d.communityId,
    vendorId: d.vendorId,
    status: d.status,
    description: d.description,
    whatsIncluded: d.whatsIncluded,
    serviceDate: isoDate(d.serviceDate),
    backupDate: d.backupDate ? isoDate(d.backupDate) : "",
    arrivalWindow: d.arrivalWindow,
    signupDeadline: utcToMountainLocal(d.signupDeadline),
    capacity: String(d.capacity),
    normalPrice: dollars(d.normalPriceCents),
    tiers: d.tiers.map((t) => ({ minHomes: String(t.minHomes), price: dollars(t.priceCents) })),
    addOns: d.addOns.map((a) => ({ id: a.id, name: a.name, description: a.description, price: dollars(a.priceCents) })),
    commission: percent(d.commissionBps),
    managerShare: percent(d.managerShareBps),
    hoaShare: percent(d.hoaShareBps),
    shareBasis: d.shareBasis,
    referralCredit: dollars(d.referralCreditCents),
    referralCap: dollars(d.referralCreditCapCents),
    reserveFundLine: d.reserveFundLine,
    guaranteeLine: d.guaranteeLine,
    cancellationPolicy: d.cancellationPolicy,
  };
}
