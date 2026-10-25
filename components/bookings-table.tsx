'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { dateLabel, inr, statusClass } from '@/lib/format';
import BookingListActions from '@/components/booking-list-actions';
import WhatsAppDraftButton from '@/components/whatsapp-draft-button';

const bookingStatuses = [
  'Awaiting Stock',
  'Partially Received',
  'Ready for Pickup',
  'Partially Collected',
  'Completed',
  'Cancelled',
  'Returned / Refunded',
];

export default function BookingsTable({ bookings, advancesByBooking = {} }: { bookings: any[]; advancesByBooking?: Record<string, number> }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All statuses');
  const [range, setRange] = useState('all');

  const filtered = useMemo(() => bookings.filter((booking) => {
    const medicineText = (booking.booking_items || [])
      .map((item: any) => `${item.product_code || ''} ${item.product_name} ${item.strength || ''} ${item.pack_size || ''}`)
      .join(' ');
    const haystack = `${booking.booking_code} ${booking.customer_name || ''} ${booking.customer_phone} ${medicineText}`.toLowerCase();
    if (query && !haystack.includes(query.toLowerCase().trim())) return false;
    if (status !== 'All statuses' && booking.status !== status) return false;
    if (range === '7days' && Date.now() - new Date(booking.created_at).getTime() > 7 * 86400000) return false;
    if (range === '30days' && Date.now() - new Date(booking.created_at).getTime() > 30 * 86400000) return false;
    return true;
  }), [bookings, query, status, range]);

  const counts = useMemo(() => ({
    total: bookings.length,
    awaiting: bookings.filter((booking) => booking.status === 'Awaiting Stock').length,
    ready: bookings.filter((booking) => booking.status === 'Ready for Pickup').length,
    cancelled: bookings.filter((booking) => booking.status === 'Cancelled').length,
  }), [bookings]);

  return (
    <div className="booking-register">
      <div className="booking-register-stats" aria-label="Booking totals">
        <button type="button" className={`booking-register-stat ${status === 'All statuses' ? 'booking-register-stat-active' : ''}`} onClick={() => setStatus('All statuses')}>
          <span className="booking-register-stat-label">All records</span>
          <strong>{counts.total.toLocaleString('en-IN')}</strong>
          <span className="booking-register-stat-foot">Saved bookings</span>
        </button>
        <button type="button" className={`booking-register-stat ${status === 'Awaiting Stock' ? 'booking-register-stat-active' : ''}`} onClick={() => setStatus('Awaiting Stock')}>
          <span className="booking-register-stat-label">Awaiting stock</span>
          <strong>{counts.awaiting.toLocaleString('en-IN')}</strong>
          <span className="booking-register-stat-foot">Still to source</span>
        </button>
        <button type="button" className={`booking-register-stat ${status === 'Ready for Pickup' ? 'booking-register-stat-active' : ''}`} onClick={() => setStatus('Ready for Pickup')}>
          <span className="booking-register-stat-label">Ready for pickup</span>
          <strong>{counts.ready.toLocaleString('en-IN')}</strong>
          <span className="booking-register-stat-foot">Waiting for customer</span>
        </button>
        <button type="button" className={`booking-register-stat ${status === 'Cancelled' ? 'booking-register-stat-active' : ''}`} onClick={() => setStatus('Cancelled')}>
          <span className="booking-register-stat-label">Cancelled</span>
          <strong>{counts.cancelled.toLocaleString('en-IN')}</strong>
          <span className="booking-register-stat-foot">History retained</span>
        </button>
      </div>

      <section className="card booking-register-card">
        <div className="card-header booking-register-header">
          <div>
            <div className="card-title">Booking register</div>
            <div className="card-description">{filtered.length} shown of {bookings.length} records · Call customers, open order details or prepare WhatsApp updates.</div>
          </div>
          <Link href="/bookings/new" className="btn btn-primary">＋ New booking</Link>
        </div>

        <div className="booking-register-filters">
          <label className="field booking-register-search">
            <span>Search bookings</span>
            <input aria-label="Search bookings" className="input" placeholder="Booking ID, customer, mobile or medicine…" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label className="field">
            <span>Status</span>
            <select aria-label="Filter by status" className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option>All statuses</option>
              {bookingStatuses.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Date range</span>
            <select aria-label="Filter by booking date" className="select" value={range} onChange={(event) => setRange(event.target.value)}>
              <option value="all">Any date</option>
              <option value="7days">Last 7 days</option>
              <option value="30days">Last 30 days</option>
            </select>
          </label>
          {(query || status !== 'All statuses' || range !== 'all') && (
            <button type="button" className="btn btn-secondary booking-filter-clear" onClick={() => { setQuery(''); setStatus('All statuses'); setRange('all'); }}>Clear filters</button>
          )}
        </div>

        {filtered.length ? (
          <div className="table-wrap booking-register-table-wrap">
            <table className="booking-register-table">
              <thead><tr><th>Booking</th><th>Customer</th><th>Medicine request</th><th>Received</th><th>Advance</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map((booking: any) => {
                  const items = booking.booking_items || [];
                  const requested = items.reduce((sum: number, item: any) => sum + Number(item.requested_quantity || 0), 0);
                  const received = items.reduce((sum: number, item: any) => sum + Number(item.received_quantity || 0), 0);
                  const hasPickup = items.some((item: any) => Number(item.collected_quantity || 0) > 0);
                  const terminalStatus = ['Completed', 'Cancelled', 'Returned / Refunded'].includes(booking.status);
                  const canCancel = !terminalStatus && !hasPickup;
                  return (
                    <tr key={booking.id} className={booking.status === 'Cancelled' ? 'booking-register-row-cancelled' : undefined}>
                      <td>
                        <Link href={`/bookings/${booking.id}`} className="booking-register-reference">
                          <span className="table-primary">{booking.booking_code}</span>
                          <span className="table-secondary">{dateLabel(booking.created_at)}</span>
                        </Link>
                      </td>
                      <td>
                        <div className="table-primary">{booking.customer_name || 'Customer'}</div>
                        <a className="booking-register-phone" href={`tel:${String(booking.customer_phone || '').replace(/[^0-9+]/g, '')}`}>{booking.customer_phone}</a>
                      </td>
                      <td>
                        <div className="table-primary">{items[0]?.product_name || '—'}</div>
                        <div className="table-secondary">{items.length > 1 ? `${items.length - 1} more item(s)` : items[0]?.strength || 'Medicine request'}</div>
                      </td>
                      <td><span className="booking-register-quantity">{received}</span><span className="muted"> / {requested}</span></td>
                      <td className="booking-register-money">{inr(advancesByBooking[booking.id] || 0)}</td>
                      <td>
                        <BookingListActions
                          bookingId={booking.id}
                          bookingCode={booking.booking_code}
                          phone={booking.customer_phone}
                          status={booking.status}
                          canCancel={false}
                        />
                        <div className="booking-row-actions" style={{marginTop:6,flexWrap:'wrap'}}>
                          <WhatsAppDraftButton bookingId={booking.id} phone={booking.customer_phone} kind="order_received" label="WhatsApp: Received" message={'*Ratan Medical Hall*\nOrder received\nBooking ID: '+booking.booking_code+'\n\nWe have received your medicine order and are checking availability. We will update you shortly.\n\nRegards,\nRatan Medical Hall'} />
                          <WhatsAppDraftButton bookingId={booking.id} phone={booking.customer_phone} kind="delivered_adjustment" label="WhatsApp: Delivered" message={'*Ratan Medical Hall*\nOrder delivered & advance adjusted\nBooking ID: '+booking.booking_code+'\n\nYour medicine order has been delivered/collected. Your advance has been adjusted against the final bill. Please contact us if you need payment details.\n\nRegards,\nRatan Medical Hall'} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">⌕</div>
            <div className="empty-title">{bookings.length ? 'No bookings match these filters' : 'No bookings recorded yet'}</div>
            <div className="empty-copy">{bookings.length ? 'Try another search, status or date range.' : 'Start with a new booking. Saved records will appear here for quick calling and follow-up.'}</div>
            {bookings.length ? (
              <button className="btn btn-secondary" type="button" onClick={() => { setQuery(''); setStatus('All statuses'); setRange('all'); }}>Clear filters</button>
            ) : (
              <Link href="/bookings/new" className="btn btn-primary">＋ Create first booking</Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
