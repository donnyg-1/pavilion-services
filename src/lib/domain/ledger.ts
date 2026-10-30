// Charge and refund math. All amounts are integer cents; rates are basis points.
//
// Per completed job:
//   commission   = final price × commission rate
//   manager/HOA  = paid out of the commission (basis: % of price or % of commission)
//   pavilion net = commission − manager − HOA
//   vendor       = final price − commission − card processing fee
//
// Invariant for every ledger row: vendor + manager + hoa + pavilionNet + processingFee = finalPrice.

export type ShareBasisName = "price" | "commission";

export type Rates = {
  commissionBps: number;
  managerShareBps: number;
  hoaShareBps: number;
  shareBasis: ShareBasisName;
};

export type LedgerAmounts = {
  finalPriceCents: number;
  commissionCents: number;
  managerShareCents: number;
  hoaShareCents: number;
  pavilionNetCents: number;
  processingFeeCents: number;
  feeAbsorbedCents: number;
  vendorPayoutCents: number;
};

/** Rounds amount × bps / 10000 to the nearest cent, halves away from zero. */
export function applyBps(amountCents: number, bps: number): number {
  const sign = amountCents < 0 ? -1 : 1;
  return sign * Math.floor((Math.abs(amountCents) * bps + 5000) / 10000);
}

/** Proportional share of `part` for `numerator/denominator`, rounded to the cent. */
function prorate(part: number, numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((part * numerator) / denominator);
}

export function validateRates(r: Rates): string[] {
  const errors: string[] = [];
  for (const [label, v] of [["Commission", r.commissionBps], ["Manager share", r.managerShareBps], ["HOA share", r.hoaShareBps]] as const) {
    if (!Number.isInteger(v) || v < 0 || v > 10000) errors.push(`${label} must be between 0% and 100%.`);
  }
  const sharesOfPrice = r.shareBasis === "price" ? r.managerShareBps + r.hoaShareBps : ((r.managerShareBps + r.hoaShareBps) * r.commissionBps) / 10000;
  if (sharesOfPrice > r.commissionBps) errors.push("Manager + HOA shares can't be more than Pavilion's commission.");
  return errors;
}

export function computeChargeLedger(finalPriceCents: number, processingFeeCents: number, r: Rates): LedgerAmounts {
  if (!Number.isInteger(finalPriceCents) || finalPriceCents < 0) throw new Error("Final price must be a non-negative integer of cents");
  const errors = validateRates(r);
  if (errors.length) throw new Error(errors.join(" "));

  const commissionCents = applyBps(finalPriceCents, r.commissionBps);
  const shareBase = r.shareBasis === "price" ? finalPriceCents : commissionCents;
  let managerShareCents = applyBps(shareBase, r.managerShareBps);
  let hoaShareCents = applyBps(shareBase, r.hoaShareBps);
  // Rounding can't push the shares past the commission.
  if (managerShareCents + hoaShareCents > commissionCents) {
    hoaShareCents = Math.max(0, commissionCents - managerShareCents);
    managerShareCents = Math.min(managerShareCents, commissionCents);
  }

  return {
    finalPriceCents,
    commissionCents,
    managerShareCents,
    hoaShareCents,
    pavilionNetCents: commissionCents - managerShareCents - hoaShareCents,
    processingFeeCents,
    feeAbsorbedCents: 0,
    vendorPayoutCents: finalPriceCents - commissionCents - processingFeeCents,
  };
}

/**
 * Refund row (negative amounts) for refunding `refundCents` of an original charge.
 * Every party gives back its proportional share. Stripe keeps its processing fee,
 * and Pavilion absorbs it, so the vendor isn't left paying a fee on a refunded job.
 */
export function computeRefundLedger(original: LedgerAmounts, refundCents: number, alreadyRefundedCents = 0): LedgerAmounts {
  const P = original.finalPriceCents;
  if (!Number.isInteger(refundCents) || refundCents <= 0) throw new Error("Refund must be a positive number of cents");
  if (refundCents + alreadyRefundedCents > P) throw new Error("Refund is more than what's left on the charge");

  // Prorate cumulatively so several partial refunds add up exactly to a full refund.
  const cum = (part: number, upTo: number) => prorate(part, upTo, P);
  const before = alreadyRefundedCents;
  const after = alreadyRefundedCents + refundCents;
  const delta = (part: number) => cum(part, after) - cum(part, before);

  const commission = delta(original.commissionCents);
  const manager = delta(original.managerShareCents);
  const hoa = delta(original.hoaShareCents);
  const feeAbsorbed = delta(original.processingFeeCents);

  return {
    finalPriceCents: -refundCents,
    commissionCents: -commission,
    managerShareCents: -manager,
    hoaShareCents: -hoa,
    pavilionNetCents: -(commission - manager - hoa) - feeAbsorbed,
    processingFeeCents: 0,
    feeAbsorbedCents: feeAbsorbed,
    vendorPayoutCents: -(refundCents - commission - feeAbsorbed),
  };
}

/** Stripe's standard US card pricing, used only when the real fee isn't available (mock mode). */
export function estimateStripeFeeCents(amountCents: number): number {
  return applyBps(amountCents, 290) + 30;
}

export function sumLedger(rows: LedgerAmounts[]): LedgerAmounts {
  const total: LedgerAmounts = {
    finalPriceCents: 0, commissionCents: 0, managerShareCents: 0, hoaShareCents: 0,
    pavilionNetCents: 0, processingFeeCents: 0, feeAbsorbedCents: 0, vendorPayoutCents: 0,
  };
  for (const r of rows) {
    for (const k of Object.keys(total) as (keyof LedgerAmounts)[]) total[k] += r[k];
  }
  return total;
}
