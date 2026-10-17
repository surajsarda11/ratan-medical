import { describe, expect, it } from 'vitest';
import { invoiceFingerprint } from '../lib/invoice-fingerprint';

describe('invoice duplicate fingerprint', () => {
  const base = { supplier:'Example Supplier', invoiceNumber:'INV-123', invoiceDate:'2026-10-17', rows:[{ source_name:'Example tablet', quantity:10, mrp:15 }] };
  it('is stable for the same invoice contents', () => {
    expect(invoiceFingerprint(base)).toBe(invoiceFingerprint({ ...base, supplier:' example supplier ', invoiceNumber:'inv-123' }));
  });
  it('changes when invoice contents change', () => {
    expect(invoiceFingerprint(base)).not.toBe(invoiceFingerprint({ ...base, rows:[{ source_name:'Example tablet', quantity:11, mrp:15 }] }));
  });
});
