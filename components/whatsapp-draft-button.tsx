'use client';

import { useEffect, useState } from 'react';
import { markWhatsAppOpenedAction } from '@/lib/actions';

type Notice = { tone: 'success' | 'warning' | 'error'; message: string };

export default function WhatsAppDraftButton({ bookingId, phone, message, kind = 'booking_confirmation', label = 'Open WhatsApp draft' }: { bookingId:string; phone:string; message:string; kind?:string; label?:string }) {
  const digits = phone.replace(/\D/g,'');
  const href = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return <>
    <button type="button" className="btn btn-primary" onClick={async () => {
      // Open synchronously as a user gesture so popup blockers are less likely to intervene.
      const opened = window.open(href, '_blank');
      if (!opened) {
        setNotice({ tone: 'error', message: 'WhatsApp could not be opened. Allow pop-ups for this site or try the button again.' });
        return;
      }
      try { opened.opener = null; } catch {}
      setNotice({ tone: 'success', message: 'WhatsApp draft opened. Review the text and tap Send yourself; this app cannot verify delivery.' });
      const data = new FormData();
      data.set('booking_id', bookingId);
      data.set('kind', kind);
      try {
        await markWhatsAppOpenedAction(data);
      } catch {
        setNotice({ tone: 'warning', message: 'WhatsApp opened, but the app could not record that the draft was opened. Sending and delivery remain unverified.' });
      }
    }}>↗ {label}</button>
    {notice && <div className={'action-toast action-toast-' + notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'} aria-live={notice.tone === 'error' ? 'assertive' : 'polite'}>
      <div className="action-toast-icon" aria-hidden="true">{notice.tone === 'success' ? '✓' : notice.tone === 'warning' ? '!' : '×'}</div>
      <div className="action-toast-copy"><strong>{notice.tone === 'success' ? 'WhatsApp draft ready' : notice.tone === 'warning' ? 'Draft activity not recorded' : 'Could not open WhatsApp'}</strong><span>{notice.message}</span></div>
      <button type="button" className="action-toast-close" onClick={() => setNotice(null)} aria-label="Dismiss notification">×</button>
    </div>}
  </>;
}
