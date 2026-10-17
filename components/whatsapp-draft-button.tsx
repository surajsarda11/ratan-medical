'use client';
import { markWhatsAppOpenedAction } from '@/lib/actions';
export default function WhatsAppDraftButton({ bookingId, phone, message, kind = 'booking_confirmation', label = 'Open WhatsApp draft' }: { bookingId:string; phone:string; message:string; kind?:string; label?:string }) {
  const digits = phone.replace(/\D/g,'');
  const href = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  return <button type="button" className="btn btn-primary" onClick={() => {
    // Open synchronously to avoid popup blockers; log only that a draft was opened, never that it was sent.
    window.open(href, '_blank', 'noopener,noreferrer');
    const data = new FormData(); data.set('booking_id', bookingId); data.set('kind', kind);
    void markWhatsAppOpenedAction(data);
  }}>↗ {label}</button>;
}
