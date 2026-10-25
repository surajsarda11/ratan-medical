'use client';

import Link from 'next/link';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cancelBookingFromListAction, deleteBookingAction, type ActionState } from '@/lib/actions';

export default function BookingListActions({
  bookingId,
  bookingCode,
  phone,
  status,
  canCancel,
}: {
  bookingId: string;
  bookingCode: string;
  phone: string;
  status: string;
  canCancel: boolean;
}) {
  const [state, formAction, pending] = useActionState(cancelBookingFromListAction, {} as ActionState);
  const router = useRouter();
  const dialNumber = phone.replace(/[^0-9+]/g, '');

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <div className="booking-row-action-wrap">
      <div className="booking-row-actions">
        <a
          className="btn btn-call btn-small"
          href={`tel:${dialNumber}`}
          aria-label={`Call ${phone} for booking ${bookingCode}`}
          title="Open your device's phone app to call this customer"
        >
          ☎ Call
        </a>
        <Link className="btn btn-secondary btn-small" href={`/bookings/${bookingId}`}>
          Open →
        </Link>
        <form action={deleteBookingAction} onSubmit={(event) => {
          if (!window.confirm("Permanently delete this booking and its related records? This cannot be undone.")) event.preventDefault();
        }}>
          <input type="hidden" name="booking_id" value={bookingId} />
          <button className="btn btn-danger btn-small" type="submit">Delete</button>
        </form>
        {canCancel && status !== 'Cancelled' && (
          <form
            action={formAction}
            onSubmit={(event) => {
              const confirmed = window.confirm(
                `Mark booking ${bookingCode} as Cancelled? This keeps the booking and audit history; it does not delete records or automatically refund an advance.`,
              );
              if (!confirmed) event.preventDefault();
            }}
          >
            <input type="hidden" name="booking_id" value={bookingId} />
            <button className="btn btn-danger btn-small" type="submit" disabled={pending}>
              {pending ? 'Cancelling…' : 'Cancel booking'}
            </button>
          </form>
        )}
      </div>
      {state.error && <div className="booking-action-message booking-action-error" role="alert">{state.error}</div>}
      {state.success && <div className="booking-action-message booking-action-success" role="status">{state.success}</div>}
    </div>
  );
}
