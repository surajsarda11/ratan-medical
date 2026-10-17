import { describe, expect, it } from 'vitest';
import { compareInvoiceRow } from '../lib/matching';

describe('invoice product matching', () => {
  const booking = { product_name: 'Amoxicillin', strength: '500 mg', dosage_form: 'Capsule', brand: 'Example', pack_size: '10 capsules', product_code: 'AMX500' };
  it('uses an exact product code first', () => {
    expect(compareInvoiceRow({ sku: 'AMX500', source_name: 'Different catalogue label' }, booking).kind).toBe('Exact match');
  });
  it('marks a fully specified identity as exact', () => {
    expect(compareInvoiceRow({ source_name:'amoxicillin', strength:'500mg', dosage_form:'capsule', brand:'Example', pack_size:'10 capsules' }, booking).kind).toBe('Exact match');
  });
  it('does not exact-match a name when strength differs', () => {
    expect(compareInvoiceRow({ source_name:'Amoxicillin', strength:'250 mg', dosage_form:'Capsule', brand:'Example', pack_size:'10 capsules' }, booking).kind).not.toBe('Exact match');
  });
  it('does not auto-exact-match when product identity details are missing', () => {
    expect(compareInvoiceRow({ source_name:'Amoxicillin' }, booking).kind).toBe('Possible match');
  });
  it('returns no safe match for an unrelated medicine', () => {
    expect(compareInvoiceRow({ source_name:'Insulin Glargine' }, booking).kind).toBe('No safe match');
  });
});
