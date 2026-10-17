import { createHash } from 'node:crypto';
export function invoiceFingerprint(input: { supplier?: string | null; invoiceNumber?: string | null; invoiceDate?: string | null; rows: unknown[] }) {
  const canonical = JSON.stringify({
    supplier: (input.supplier || '').trim().toLowerCase(),
    invoiceNumber: (input.invoiceNumber || '').trim().toLowerCase(),
    invoiceDate: input.invoiceDate || null,
    rows: input.rows,
  });
  return createHash('sha256').update(canonical).digest('hex');
}
