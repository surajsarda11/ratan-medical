import { inr } from '@/lib/format';
export function bookingConfirmationMessage(booking: any, items: any[], advance: number, shopName = 'Ratan Medical Hall', footer = 'Regards,\nRatan Medical Hall') {
  const itemText = items.map((item, index) => `${index + 1}. ${item.product_name}${item.strength ? ` ${item.strength}` : ''}${item.pack_size ? ` (${item.pack_size})` : ''}\n   Requested: ${item.requested_quantity} ${item.unit_label || 'packs'}`).join('\n');
  return `*${shopName}*\nMedicine Booking Confirmation\nBooking ID: ${booking.booking_code}\nCustomer: ${booking.customer_name || 'Customer'}\n\nItems:\n${itemText}\n\nAdvance received: ${inr(advance)}\nStatus: Awaiting stock\n\nWe will contact you when the requested medicine is available.\n\n${footer}`;
}
