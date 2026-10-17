import { describe, expect, it } from 'vitest';
import { calculateSettlement } from '../lib/finance';

describe('settlement financial calculations', () => {
  it('calculates multi-item sale value in paise without binary float accumulation', () => {
    const result = calculateSettlement({
      lines: [{ quantity: 2, mrp: '18.00' }, { quantity: 1, mrp: '12.50' }],
      discount: '1.50', advanceApplied: '20.00', additionalPayment: '10.00', availableAdvance: '35.00',
    });
    expect(result.grossCents).toBe(4850);
    expect(result.netCents).toBe(4700);
    expect(result.balanceDueCents).toBe(1700);
    expect(result.refundDueCents).toBe(0);
  });

  it('supports zero advance', () => {
    const result = calculateSettlement({ lines: [{ quantity: 1, mrp: 50 }], discount: 0, advanceApplied: 0, additionalPayment: 0, availableAdvance: 0 });
    expect(result.balanceDueCents).toBe(5000);
    expect(result.refundDueCents).toBe(0);
  });

  it('flags overpayment as refund due rather than a negative payable balance', () => {
    const result = calculateSettlement({ lines: [{ quantity: 1, mrp: 80 }], discount: 0, advanceApplied: 100, additionalPayment: 0, availableAdvance: 100 });
    expect(result.balanceDueCents).toBe(0);
    expect(result.refundDueCents).toBe(2000);
  });

  it('rejects a discount larger than gross sale value', () => {
    expect(() => calculateSettlement({ lines: [{ quantity: 1, mrp: 50 }], discount: 51, advanceApplied: 0, additionalPayment: 0, availableAdvance: 0 })).toThrow(/Discount cannot exceed/);
  });

  it('prevents applying more advance than the unused advance amount', () => {
    expect(() => calculateSettlement({ lines: [{ quantity: 1, mrp: 50 }], discount: 0, advanceApplied: 21, additionalPayment: 0, availableAdvance: 20 })).toThrow(/unused advance/);
  });
});
