import { describe, expect, it } from 'vitest';
import { prepareSettlementMessage } from '../lib/messages';

describe('customer settlement message', () => {
  const legacyBill = [
    '*Ratan Medical Hall*',
    'Medicine Order Update',
    'Booking ID: RMH-261018-A12345',
    'Items:',
    '1. Example item',
    '   Quantity: 2 packs',
    'Gross total: ₹650.00',
    'Discount: ₹25.00',
    'Net sale value: ₹625.00',
    'Advance applied: ₹200.00',
    'Additional payment: ₹425.00',
    'Status: Collected',
  ].join('\n');

  it('removes discount lines and labels completed orders clearly', () => {
    const message = prepareSettlementMessage(legacyBill, 'Completed');
    expect(message).toContain('Delivery completed — itemized bill');
    expect(message).toContain('Sale total: ₹625.00');
    expect(message).toContain('Status: Delivery completed');
    expect(message).not.toMatch(/Gross total:|Discount:/i);
  });

  it('marks partial settlement messages accurately', () => {
    const partialBill = legacyBill.replace('Status: Collected', 'Status: Partially collected');
    const message = prepareSettlementMessage(partialBill, 'Partially Collected');
    expect(message).toContain('Pickup / partial collection — itemized bill');
    expect(message).toContain('Sale total: ₹625.00');
    expect(message).not.toMatch(/Gross total:|Discount:/i);
    expect(message).toContain('Status: Partially collected');
  });
});
