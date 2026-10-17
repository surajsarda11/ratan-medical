import { normalizeMedicine } from '@/lib/format';
export type MatchKind = 'Exact match' | 'Possible match' | 'No safe match';
export function compareInvoiceRow(row: any, item: any): { kind: MatchKind; score: number } {
  const norm = normalizeMedicine;
  if (row.sku && item.product_code && norm(row.sku) === norm(item.product_code)) return { kind: 'Exact match', score: 1 };
  const sourceName = norm(row.source_name); const productName = norm(item.product_name);
  const nameExact = Boolean(sourceName && sourceName === productName);
  const identityAttributes = ['strength', 'dosage_form', 'brand', 'pack_size'];
  const identityMatches = identityAttributes.every((key) => norm(row[key]) === norm(item[key]));
  const identityIsSpecific = Boolean(norm(row.strength) && norm(item.strength) && norm(row.dosage_form) && norm(item.dosage_form) && norm(row.pack_size) && norm(item.pack_size));
  if (nameExact && identityMatches && identityIsSpecific) return { kind: 'Exact match', score: 0.99 };
  const left = new Set(sourceName.split(' ').filter(Boolean)); const right = new Set(productName.split(' ').filter(Boolean));
  const union = new Set([...left, ...right]); let overlap = 0;
  left.forEach((token) => { if (right.has(token)) overlap += 1; });
  const similarity = union.size ? overlap / union.size : 0;
  if (similarity >= 0.5 || nameExact) return { kind: 'Possible match', score: nameExact ? 0.8 : similarity };
  return { kind: 'No safe match', score: similarity };
}
