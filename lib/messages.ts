import { inr } from '@/lib/format';
export function bookingConfirmationMessage(booking: any, items: any[], advance: number, shopName = 'Ratan Medical Hall', footer = 'Regards,\nRatan Medical Hall') {
  const itemText = items.map((item, index) => `${index + 1}. ${item.product_name}${item.strength ? ` ${item.strength}` : ''}${item.pack_size ? ` (${item.pack_size})` : ''}\n   Requested: ${item.requested_quantity} ${item.unit_label || 'packs'}`).join('\n');
  return `*${shopName}*\nMedicine Booking Confirmation\nBooking ID: ${booking.booking_code}\nCustomer: ${booking.customer_name || 'Customer'}\n\nItems:\n${itemText}\n\nAdvance received: ${inr(advance)}\nStatus: Awaiting stock\n\nWe will contact you when the requested medicine is available.\n\n${footer}`;
}


export function prepareSettlementMessage(message: string, bookingStatus: string) {
  return String(message || '')
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:Gross total|Discount)\s*:/i.test(line))
    .map((line) => {
      if (/^\s*Net sale value\s*:/i.test(line)) return line.replace(/^\s*Net sale value\s*:/i, 'Sale total:');
      if (/^Medicine Order Update$/i.test(line.trim())) return bookingStatus === 'Completed' ? 'Delivery completed — itemized bill' : 'Pickup / partial collection — itemized bill';
      if (bookingStatus === 'Completed' && /^\s*Status:\s*Collected\b/i.test(line)) return 'Status: Delivery completed';
      return line;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
