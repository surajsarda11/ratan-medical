export type SettlementLineInput = { quantity: number | string; mrp: number | string };
export type SettlementCalculation = {
  grossCents: number; discountCents: number; netCents: number;
  advanceAppliedCents: number; additionalPaymentCents: number;
  balanceDueCents: number; refundDueCents: number;
};
const cents = (value: number | string) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new RangeError('Amounts must be finite and non-negative.');
  return Math.round(n * 100);
};
export function calculateSettlement(input: {
  lines: SettlementLineInput[]; discount: number | string; advanceApplied: number | string;
  additionalPayment: number | string; availableAdvance: number | string;
}): SettlementCalculation {
  const grossCents = input.lines.reduce((sum, line) => {
    const quantity = Number(line.quantity), mrp = Number(line.mrp);
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(mrp) || mrp < 0) throw new RangeError('Line quantity and MRP must be finite and non-negative.');
    return sum + Math.round(quantity * mrp * 100);
  }, 0);
  const discountCents = cents(input.discount);
  const advanceAppliedCents = cents(input.advanceApplied);
  const additionalPaymentCents = cents(input.additionalPayment);
  const availableAdvanceCents = cents(input.availableAdvance);
  if (discountCents > grossCents) throw new RangeError('Discount cannot exceed gross sale value.');
  if (advanceAppliedCents > availableAdvanceCents) throw new RangeError('Applied advance cannot exceed available unused advance.');
  const netCents = grossCents - discountCents;
  const paidCents = advanceAppliedCents + additionalPaymentCents;
  return {
    grossCents, discountCents, netCents, advanceAppliedCents, additionalPaymentCents,
    balanceDueCents: Math.max(netCents - paidCents, 0),
    refundDueCents: Math.max(paidCents - netCents, 0),
  };
}
