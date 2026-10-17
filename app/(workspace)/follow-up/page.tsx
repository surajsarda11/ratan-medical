import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { markPhoneFollowupCompletedAction } from '@/lib/actions';
import { dateLabel, dateTimeLabel, statusClass } from '@/lib/format';

export default async function PhoneFollowupPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id,booking_code,customer_name,customer_phone,status,created_at,ready_for_pickup_at,booking_items(product_name,strength,pack_size,received_quantity,collected_quantity,unit_label)')
    .eq('customer_no_smartphone', true)
    .is('phone_followup_completed_at', null)
    .in('status', ['Ready for Pickup', 'Partially Collected'])
    .order('ready_for_pickup_at', { ascending: true });

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="kicker">MANUAL CUSTOMER CONTACT</div>
          <h1>Phone follow-ups</h1>
          <p>Call customers who do not have a smartphone when their requested medicines are ready. Mark each call complete to keep this list clear.</p>
        </div>
        <Link href="/ready" className="btn btn-secondary">View pickup queue →</Link>
      </div>

      {query.updated === '1' && <div className="success-text" style={{ marginBottom: 16 }}>Phone follow-up marked complete.</div>}
      {query.updated === 'error' && <div className="error-text" style={{ marginBottom: 16 }}>This follow-up could not be updated. Refresh the page and try again.</div>}
      {error && <div className="error-text" style={{ marginBottom: 16 }}>The phone follow-up list could not be loaded. Apply the pickup scheduler migration, then refresh.</div>}

      <div className="notice notice-neutral" style={{ marginBottom: 16 }}>
        These customers are excluded from automated WhatsApp pickup notifications. Use the Call button to contact them by phone, then mark the follow-up complete.
      </div>

      {(bookings || []).length ? (
        <div className="phone-followup-list">
          {(bookings || []).map((booking: any) => {
            const remainingItems = (booking.booking_items || [])
              .map((item: any) => ({
                name: [item.product_name, item.strength, item.pack_size].filter(Boolean).join(' · '),
                quantity: Math.max(0, Number(item.received_quantity || 0) - Number(item.collected_quantity || 0)),
                unit: item.unit_label || 'packs',
              }))
              .filter((item: any) => item.quantity > 0);

            return (
              <section className="card phone-followup-card" key={booking.id}>
                <div className="card-header">
                  <div>
                    <div className="card-title">{booking.customer_name || 'Customer'} · {booking.booking_code}</div>
                    <div className="card-description">
                      Ready since {dateTimeLabel(booking.ready_for_pickup_at)} · booked {dateLabel(booking.created_at)}
                    </div>
                  </div>
                  <span className={statusClass(booking.status)}>{booking.status}</span>
                </div>
                <div className="card-pad phone-followup-content">
                  <div>
                    <div className="phone-followup-phone">{booking.customer_phone}</div>
                    <div className="phone-followup-items">
                      {remainingItems.length
                        ? remainingItems.map((item: any, index: number) => (
                            <div className="phone-followup-item" key={index}>
                              <span>{item.name}</span>
                              <strong>{item.quantity} {item.unit}</strong>
                            </div>
                          ))
                        : <span className="muted small">No remaining pickup quantities are listed.</span>}
                    </div>
                  </div>
                  <div className="phone-followup-actions">
                    <a className="btn btn-primary phone-call-button" href={'tel:' + booking.customer_phone}>☎ Call customer</a>
                    <Link className="btn btn-secondary" href={'/bookings/' + booking.id}>Booking details</Link>
                    <form action={markPhoneFollowupCompletedAction}>
                      <input type="hidden" name="booking_id" value={booking.id} />
                      <button className="btn btn-secondary" type="submit">✓ Mark follow-up complete</button>
                    </form>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="card empty-state">
          <div className="empty-icon">☎</div>
          <div className="empty-title">No phone follow-ups pending</div>
          <div className="empty-copy">Customers marked as not having a smartphone will appear here after their bookings become ready for pickup.</div>
          <Link className="btn btn-primary" href="/bookings/new">Create a booking</Link>
        </div>
      )}
    </>
  );
}
