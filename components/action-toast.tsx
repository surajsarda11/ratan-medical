'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

type Toast = { title: string; message: string; tone: 'success' | 'warning' | 'error' };

function feedbackFrom(pathname: string, params: URLSearchParams): Toast | null {
  const status = params.get('status');
  const value = params.get('value');

  if (status === 'needs_stock') {
    return { title: 'Order status not changed', message: 'This order cannot be marked Ready for Pickup until the requested stock has been received and validated.', tone: 'error' };
  }
  if (status === 'needs_pickup') {
    return { title: 'Order is not complete yet', message: 'Record collection of all requested units before marking this order Completed.', tone: 'error' };
  }
  if (status === 'error') {
    return { title: 'Update failed', message: 'The order status was not updated. Refresh the page and try again.', tone: 'error' };
  }
  if (status === 'updated') {
    if (value === 'Completed') {
      return { title: 'Order marked Completed', message: 'No customer message was sent automatically. Open the WhatsApp Messenger draft and send it manually if the customer has agreed.', tone: 'warning' };
    }
    if (value === 'Ready for Pickup') {
      return { title: 'Order ready for pickup', message: 'No customer message was sent automatically. You can notify the customer manually through WhatsApp Messenger if they have agreed.', tone: 'warning' };
    }
    return { title: 'Order status updated', message: value ? 'The order status is now ' + value + '. No customer message was sent automatically.' : 'The order status was saved.', tone: 'success' };
  }

  const consent = params.get('consent');
  if (consent === 'saved') return { title: 'WhatsApp consent saved', message: 'The customer choice was saved to the booking and activity timeline.', tone: 'success' };
  if (consent === 'error') return { title: 'Consent choice not saved', message: 'Choose Agreed or Not agreed, then retry. WhatsApp messaging remains blocked unless consent is Agreed.', tone: 'error' };

  const payment = params.get('payment');
  if (payment === 'saved') return { title: 'Payment saved', message: 'The payment has been recorded in the booking ledger.', tone: 'success' };
  if (payment === 'error') return { title: 'Payment not saved', message: 'The payment could not be recorded. Please review the amount and try again.', tone: 'error' };

  const mrp = params.get('mrp');
  if (mrp === 'saved') return { title: 'MRP verification saved', message: 'The verified MRP was updated and recorded in the activity timeline.', tone: 'success' };
  if (mrp === 'error') return { title: 'MRP not updated', message: 'Enter a valid MRP and confirm the verification checkbox before saving.', tone: 'error' };

  const whatsapp = params.get('whatsapp');
  if (whatsapp === 'consent-required') return { title: 'WhatsApp action blocked', message: 'The customer has not been marked as having agreed to WhatsApp messages. Record consent in the booking first.', tone: 'warning' };
  if (whatsapp === 'marked-sent') return { title: 'Manual send confirmation recorded', message: 'The shopkeeper marked the WhatsApp message as sent. The app cannot verify delivery.', tone: 'success' };
  if (whatsapp === 'error') return { title: 'Send confirmation not recorded', message: 'The booking could not be updated. The message may have been sent, but the app did not record your confirmation.', tone: 'error' };
  if (whatsapp === 'log-error') return { title: 'Message log needs attention', message: 'The booking was updated, but the activity log could not be saved. WhatsApp delivery is not verified.', tone: 'warning' };

  const reminder = params.get('reminder');
  if (reminder === 'created') return { title: 'Reminder created', message: 'The follow-up task has been added to Reminder History.', tone: 'success' };
  if (reminder === 'updated') return { title: 'Reminder updated', message: value === 'Done' ? 'The reminder was marked done.' : value === 'Snoozed' ? 'The reminder was snoozed.' : value === 'Dismissed' ? 'The reminder was dismissed.' : 'The reminder status was saved.', tone: 'success' };
  if (reminder === 'error' || reminder === 'invalid') return { title: 'Reminder not saved', message: reminder === 'invalid' ? 'Choose a valid reminder date and time.' : 'The reminder could not be saved. Please retry.', tone: 'error' };

  if (params.get('toast') === 'import-created') {
    return { title: 'CSV draft created', message: 'No stock has changed. Review the product matches and approve each receipt allocation before stock is updated.', tone: 'success' };
  }
  if (params.get('toast') === 'import-row-ignored') {
    return { title: 'Invoice row ignored', message: 'The row was marked ignored. No stock was changed by this action.', tone: 'success' };
  }
  if (params.get('toast') === 'import-row-error') {
    return { title: 'Invoice row not updated', message: 'The row status could not be saved. Refresh the import and try again.', tone: 'error' };
  }
  if (params.get('created') === '1' && pathname.startsWith('/settlements/')) {
    return { title: 'Settlement saved', message: 'The pickup quantities and financial totals have been recorded. No message was sent automatically; review the WhatsApp Messenger draft and send it manually.', tone: 'success' };
  }
  if (params.get('created') === '1' && pathname.startsWith('/bookings/')) {
    return { title: 'Booking saved', message: 'The booking and advance, if any, have been recorded. Only prepare a WhatsApp message if the saved consent choice is Agreed.', tone: 'success' };
  }
  if (params.get('review') === 'partial') {
    return { title: 'Invoice row needs review', message: 'This row already has stock allocated. Complete or correct the allocation before marking the row ignored.', tone: 'warning' };
  }

  return null;
}

const handledParams = ['status', 'value', 'payment', 'mrp', 'whatsapp', 'consent', 'reminder', 'toast', 'created', 'review'];

function ActionToastContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [toast, setToast] = useState<Toast | null>(null);
  const query = searchParams.toString();

  useEffect(() => {
    const params = new URLSearchParams(query);
    const next = feedbackFrom(pathname, params);
    if (!next) return;

    setToast(next);
    handledParams.forEach((key) => params.delete(key));

    // Clean one-use feedback flags so refreshing does not repeat the same notification.
    const search = params.toString();
    const nextUrl = pathname + (search ? '?' + search : '') + window.location.hash;
    window.history.replaceState(null, '', nextUrl);
  }, [pathname, query]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  const icon = toast.tone === 'success' ? '✓' : toast.tone === 'warning' ? '!' : '×';

  return (
    <div className={'action-toast action-toast-' + toast.tone} role={toast.tone === 'error' ? 'alert' : 'status'} aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}>
      <div className="action-toast-icon" aria-hidden="true">{icon}</div>
      <div className="action-toast-copy">
        <strong>{toast.title}</strong>
        <span>{toast.message}</span>
      </div>
      <button type="button" className="action-toast-close" onClick={() => setToast(null)} aria-label="Dismiss notification">×</button>
    </div>
  );
}

export default function ActionToast() {
  return <ActionToastContent />;
}
