import { describe, expect, it } from 'vitest';
import { calculateSettlement } from '../lib/finance';

describe('settlement financial calculations', () => {
  it('calculates multi-item sale value in paise without binary float accumulation', () => {
    const result = calculateSettlement({
      lines: [{ quantity: 2, mrp: '18.00' }, { quantity: 1, mrp: '12.50' }],
      advanceApplied: '20.00', additionalPayment: '10.00', availableAdvance: '35.00',
    });
    expect(result.saleCents).toBe(4850);
    expect(result.balanceDueCents).toBe(1850);
    expect(result.refundDueCents).toBe(0);
  });

  it('supports zero advance', () => {
    const result = calculateSettlement({ lines: [{ quantity: 1, mrp: 50 }], advanceApplied: 0, additionalPayment: 0, availableAdvance: 0 });
    expect(result.saleCents).toBe(5000);
    expect(result.balanceDueCents).toBe(5000);
    expect(result.refundDueCents).toBe(0);
  });

  it('flags overpayment as refund due rather than a negative payable balance', () => {
    const result = calculateSettlement({ lines: [{ quantity: 1, mrp: 80 }], advanceApplied: 100, additionalPayment: 0, availableAdvance: 100 });
    expect(result.saleCents).toBe(8000);
    expect(result.balanceDueCents).toBe(0);
    expect(result.refundDueCents).toBe(2000);
  });

  it('prevents applying more advance than the unused advance amount', () => {
    expect(() => calculateSettlement({ lines: [{ quantity: 1, mrp: 50 }], advanceApplied: 21, additionalPayment: 0, availableAdvance: 20 })).toThrow(/unused advance/);
  });

  it('rejects negative or non-finite payment amounts', () => {
    expect(() => calculateSettlement({ lines: [{ quantity: 1, mrp: 50 }], advanceApplied: -1, additionalPayment: 0, availableAdvance: 10 })).toThrow(/finite and non-negative/);
    expect(() => calculateSettlement({ lines: [{ quantity: 1, mrp: 50 }], advanceApplied: 0, additionalPayment: Number.NaN, availableAdvance: 10 })).toThrow(/finite and non-negative/);
  });
});
