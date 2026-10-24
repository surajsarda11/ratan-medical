'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { createBookingAction, type ActionState, type BookingSnapshot } from '@/lib/actions';
import { inr } from '@/lib/format';
import { bookingConfirmationMessage } from '@/lib/messages';
import WhatsAppDraftButton from '@/components/whatsapp-draft-button';

type QuickLine = { product_name: string; requested_quantity: string };
const blankLine = (): QuickLine => ({ product_name: '', requested_quantity: '1' });

function BookingReadOnly({ booking, bookingId, onNewBooking }: {
  booking?: BookingSnapshot;
  bookingId: string;
  onNewBooking: () => void;
}) {
  const message = booking
    ? bookingConfirmationMessage(
        { booking_code: booking.bookingCode, customer_name: booking.customerName },
        booking.items,
        booking.advance,
        booking.shopName,
        booking.footer,
      )
    : '';

  return (
    <section className="card quick-confirmation-card">
      <div className="card-header">
        <div>
          <div className="card-title">Booking confirmed</div>
          <div className="card-description">
            {booking?.bookingCode ? 'Reference: ' + booking.bookingCode : 'Saved booking reference: ' + bookingId}
          </div>
        </div>
        <span className="status status-green">Saved · read-only</span>
      </div>

      {booking ? (
        <div className="card-pad">
          <div className="notice notice-neutral" style={{ marginBottom: 18 }}>
            This booking is saved. The details on this screen cannot be edited. Choose <strong>New booking</strong> when you are ready to record the next customer.
          </div>

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <section className="card card-pad" style={{ boxShadow: 'none' }}>
              <div className="card-title">Customer & booking</div>
              <div className="divider" />
              {booking.customerName && <div className="money-row"><span className="muted">Customer</span><b>{booking.customerName}</b></div>}
              <div className="money-row"><span className="muted">Mobile number</span><b>{booking.customerPhone}</b></div>
              <div className="money-row"><span className="muted">Booking status</span><span className="status status-amber">{booking.status}</span></div>
              <div className="money-row"><span className="muted">Created</span><b>{new Date(booking.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}</b></div>
              <div className="money-row"><span className="muted">WhatsApp permission</span><span className={booking.whatsappConsent ? 'status status-green' : 'status status-red'}>{booking.whatsappConsent ? 'Agreed' : 'Not agreed'}</span></div>
            </section>

            <section className="card card-pad" style={{ boxShadow: 'none' }}>
              <div className="card-title">Advance payment</div>
              <div className="divider" />
              <div className="money-row"><span className="muted">Advance recorded</span><b>{inr(booking.advance)}</b></div>
              {booking.advance > 0 && <div className="money-row"><span className="muted">Payment method</span><b>{booking.advanceMethod || 'Recorded'}</b></div>}
              <div className="notice notice-neutral" style={{ marginTop: 12 }}>This is an advance against the booking, not a completed medicine sale.</div>
            </section>
          </div>

          <div style={{ marginTop: 22 }}>
            <div className="card-title">Requested medicines</div>
            <div className="card-description" style={{ margin: '5px 0 12px' }}>Review what was recorded before opening the WhatsApp draft.</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Medicine / product</th><th>Requested quantity</th></tr></thead>
                <tbody>
                  {booking.items.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <div className="table-primary">{item.product_name}</div>
                        <div className="table-secondary">{[item.strength, item.pack_size].filter(Boolean).join(' · ') || 'Details not specified'}</div>
                      </td>
                      <td>{item.requested_quantity} <span className="muted">{item.unit_label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="card-pad">
          <div className="notice notice-amber">
            The booking was saved, but its details could not be loaded for this read-only view. The WhatsApp action is kept disabled to avoid sending an incomplete confirmation. You can start a new booking or inspect the saved record from All bookings.
          </div>
        </div>
      )}

      <div className="sticky-actions quick-booking-actions">
        {booking ? (
          <WhatsAppDraftButton
            bookingId={bookingId}
            phone={booking.customerPhone}
            message={message}
            kind="booking_confirmation"
            label="WhatsApp message"
            allowed={booking.whatsappConsent && Boolean(booking.bookingCode)}
          />
        ) : (
          <button type="button" className="btn btn-primary" disabled title="Booking details have not loaded">↗ WhatsApp message</button>
        )}
        <button type="button" className="btn btn-primary quick-save-button" onClick={onNewBooking}>＋ New booking</button>
      </div>
    </section>
  );
}


export default function BookingForm() {
  const [state, action, pending] = useActionState(createBookingAction, {} as ActionState);
  const [lines, setLines] = useState<QuickLine[]>([blankLine()]);
  const [advance, setAdvance] = useState('0');
  const [advanceMethod, setAdvanceMethod] = useState('Cash');
  const [whatsappConsent, setWhatsappConsent] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const parsedAdvance = Number(advance || 0);
  const itemsJson = useMemo(
    () =>
      JSON.stringify(
        lines.map((line) => ({
          product_name: line.product_name,
          product_code: '',
          generic_name: '',
          strength: '',
          dosage_form: '',
          brand: '',
          pack_size: '',
          requested_quantity: Number(line.requested_quantity),
          unit_label: 'packs',
        })),
      ),
    [lines],
  );

  useEffect(() => {
    phoneRef.current?.focus();
  }, []);

  useEffect(() => {
    if (state.error) {
      setToastVisible(true);
      const timer = window.setTimeout(() => setToastVisible(false), 6500);
      return () => window.clearTimeout(timer);
    }
    if (!state.bookingId) {
      setToastVisible(false);
      return;
    }

    setConfirmed(true);
    setToastVisible(true);
    const timer = window.setTimeout(() => setToastVisible(false), 2400);
    return () => window.clearTimeout(timer);
  }, [state]);

  const startNewBooking = () => {
    setConfirmed(false);
    setToastVisible(false);
    setLines([blankLine()]);
    setAdvance('0');
    setAdvanceMethod('Cash');
    setWhatsappConsent('');
    formRef.current?.reset();
    window.requestAnimationFrame(() => phoneRef.current?.focus());
  };

  const updateLine = (index: number, key: keyof QuickLine, value: string) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
  };

  return (
    <>
      {toastVisible && (state.bookingId || state.error) && (
        <div className={`booking-success-popup ${state.error ? "booking-error" : ""}`} role={state.error ? "alert" : "status"} aria-live={state.error ? "assertive" : "polite"}>
          <div className="booking-success-icon">✓</div>
          <div className="booking-success-copy">
            <strong>{state.error ? "Booking not saved" : "Booking has been noted"}</strong>
            <span>{state.error || "Booking saved. This read-only confirmation stays on screen until you choose New booking."}</span>
          </div>
        </div>
      )}

      {confirmed ? (
        <BookingReadOnly booking={state.booking} bookingId={state.bookingId || ''} onNewBooking={startNewBooking} />
      ) : (
      <form
        ref={formRef}
        action={action}
        className="card quick-booking-form"
      >
        <input type="hidden" name="items_json" value={itemsJson} />

        <div className="quick-booking-body">
          <div className="field quick-phone-field">
            <label htmlFor="customer_phone">Customer mobile number *</label>
            <input
              ref={phoneRef}
              className="input"
              id="customer_phone"
              name="customer_phone"
              placeholder="10-digit mobile number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              pattern="[+0-9 ()-]{10,20}"
              maxLength={20}
            />
          </div>

          <div className="field quick-consent-field">
            <label htmlFor="whatsapp_consent">Customer permission to message via WhatsApp *</label>
            <select
              className="select"
              id="whatsapp_consent"
              name="whatsapp_consent"
              value={whatsappConsent}
              onChange={(event) => setWhatsappConsent(event.target.value)}
              required
            >
              <option value="">Select the customer's choice</option>
              <option value="yes">Customer agreed</option>
              <option value="no">Customer did not agree</option>
            </select>
            <small>Record the customer's permission. Draft and manual send-confirmation actions stay blocked unless the customer agreed.</small>
          </div>

          <div className="quick-booking-main">
            <section className="quick-section">
              <div className="quick-section-heading">
                <span className="quick-step">1</span>
                <div>
                  <h2>Medicine / product</h2>
                  <p>Enter the exact product requested by the customer.</p>
                </div>
              </div>

              <div className="quick-lines">
                {lines.map((line, index) => (
                  <div className="quick-medicine-row" key={index}>
                    <div className="field">
                      <label htmlFor={'product_name_' + index}>
                        {lines.length > 1 ? 'Product ' + (index + 1) : 'Medicine or product name'} *
                      </label>
                      <input
                        className="input"
                        id={'product_name_' + index}
                        value={line.product_name}
                        onChange={(event) => updateLine(index, 'product_name', event.target.value)}
                        placeholder="e.g. exact medicine / product name"
                        maxLength={180}
                        autoComplete="off"
                        required
                      />
                    </div>
                    <div className="field quick-quantity-field">
                      <label htmlFor={'quantity_' + index}>Quantity *</label>
                      <input
                        className="input"
                        id={'quantity_' + index}
                        type="number"
                        min="1"
                        max="100000"
                        step="1"
                        inputMode="numeric"
                        value={line.requested_quantity}
                        onChange={(event) => updateLine(index, 'requested_quantity', event.target.value)}
                        required
                      />
                    </div>
                    {index > 0 && (
                      <button
                        className="btn btn-secondary quick-remove-line"
                        type="button"
                        aria-label={'Remove product ' + (index + 1)}
                        onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                className="btn btn-secondary quick-add-line"
                type="button"
                disabled={lines.length >= 20}
                onClick={() => setLines((current) => [...current, blankLine()])}
              >
                ＋ Add another medicine (optional)
              </button>
              <p className="quick-helper">
                Medicine identity matters. Confirm the name, strength and pack with the customer where needed.
              </p>
            </section>

            <section className="quick-section quick-advance-section">
              <div className="quick-section-heading">
                <span className="quick-step">2</span>
                <div>
                  <h2>Advance paid</h2>
                  <p>Enter the amount actually received from the customer.</p>
                </div>
              </div>

              <div className="field">
                <label htmlFor="advance_amount">Advance amount (₹)</label>
                <div className="quick-advance-input">
                  <span aria-hidden="true">₹</span>
                  <input
                    className="input"
                    id="advance_amount"
                    name="advance_amount"
                    type="number"
                    min="0"
                    max="10000000"
                    step="0.01"
                    inputMode="decimal"
                    value={advance}
                    onChange={(event) => setAdvance(event.target.value)}
                  />
                </div>
              </div>

              <div className="quick-advance-shortcuts" aria-label="Quick advance amount">
                <button type="button" className="btn btn-secondary" onClick={() => setAdvance('0')}>₹0</button>
                <button type="button" className="btn btn-secondary" onClick={() => setAdvance('100')}>₹100</button>
                <button type="button" className="btn btn-secondary" onClick={() => setAdvance('500')}>₹500</button>
              </div>

              {parsedAdvance > 0 && (
                <div className="field quick-payment-method">
                  <label htmlFor="advance_method">Payment method *</label>
                  <select
                    className="select"
                    id="advance_method"
                    name="advance_method"
                    value={advanceMethod}
                    onChange={(event) => setAdvanceMethod(event.target.value)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Bank transfer">Bank transfer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}

              <div className="quick-advance-summary">
                <span>Advance to record</span>
                <strong>{inr(Number.isFinite(parsedAdvance) && parsedAdvance >= 0 ? parsedAdvance : 0)}</strong>
                <small>The advance is recorded against this booking, not as a completed sale.</small>
              </div>
            </section>
          </div>

          {state.error && <div className="error-text" role="alert">{state.error}</div>}
        </div>

        <div className="sticky-actions quick-booking-actions">
          <a className="btn btn-secondary" href="/bookings">All bookings</a>
          <button
            className="btn btn-primary"
            type="button"
            disabled
            title="Confirm the booking first. WhatsApp stays unavailable unless the customer agreed."
          >↗ WhatsApp message</button>
          <button className="btn btn-primary quick-save-button" type="submit" disabled={pending}>
            {pending ? 'Confirming booking…' : '✓ Confirm booking'}
          </button>
        </div>
      </form>
      )}
    </>
  );
}
