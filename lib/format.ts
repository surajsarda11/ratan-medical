export function inr(value: number | string | null | undefined) {
  const number = typeof value === 'string' ? Number(value) : Number(value ?? 0);
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number.isFinite(number) ? number : 0);
}
export function dateLabel(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(value));
}
export function dateTimeLabel(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value));
}
export function toCents(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
export function fromCents(value: number) { return value / 100; }
export function statusClass(status: string) {
  const s = (status || '').toLowerCase();
  if (['ready for pickup', 'completed', 'settled', 'posted', 'approved'].includes(s)) return 'status status-green';
  if (['partially received', 'partially collected', 'awaiting stock', 'pending', 'draft'].includes(s)) return 'status status-amber';
  if (['cancelled', 'refund due', 'review required', 'failed'].includes(s)) return 'status status-red';
  return 'status';
}
export function normalizeMedicine(value: unknown) {
  return String(value ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ').replace(/(\d)\s+([a-z])/g, '$1$2');
}
