import { describe, expect, it } from 'vitest';
import { normalizeIndianMobile } from '../lib/phone-number';

describe('Indian mobile number normalization', () => {
  it.each([
    ['9876543210', '919876543210'],
    ['+91 98765 43210', '919876543210'],
    ['0091-9876543210', '919876543210'],
    ['09876543210', '919876543210'],
    ['919876543210', '919876543210'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it.each(['1234567890', '987654321', '+1 9876543210', '91987654321', ''])(
    'rejects invalid number %s',
    (input) => {
      expect(normalizeIndianMobile(input)).toBe('');
    },
  );
});
