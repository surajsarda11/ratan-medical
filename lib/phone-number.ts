/**
 * Convert common Indian mobile-number formats to WhatsApp-compatible country-code
 * format (91 + ten-digit mobile), or return an empty string when invalid.
 */
export function normalizeIndianMobile(input: string): string {
  let digits = String(input ?? '').replace(/\D/g, '');

  if (digits.startsWith('0091')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  if (!/^[6-9]\d{9}$/.test(digits)) return '';
  return '91' + digits;
}
