'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { createBookingAction, markWhatsAppOpenedAction, type ActionState } from '@/lib/actions';
import { inr } from '@/lib/format';

type QuickLine = { product_name: string; requested_quantity: string };
const blankLine = (): QuickLine => ({ product_name: '', requested_quantity: '1' });

export default function BookingForm() {
  const [state, action, pending] = useActionState(createBookingAction, {} as ActionState);
  const [lines, setLines] = useState<QuickLine[]>([blankLine()]);
  const [advance, setAdvance] = useState('0');
  const [advanceMethod, setAdvanceMethod] = useState('Cash');
  const [toastVisible, setToastVisible] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const whatsappWindowRef = useRef<Window | null>(null);
  const [whatsappOpened, setWhatsappOpened] = useState(false);
  const [noSmartphone, setNoSmartphone] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
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
      if (whatsappWindowRef.current && !whatsappWindowRef.current.closed) {
        whatsappWindowRef.current.close();
      }
      whatsappWindowRef.current = null;
      return;
    }
    if (!state.bookingId) return;

    let opened = false;
    const whatsappWindow = whatsappWindowRef.current;
    if (state.whatsappUrl && whatsappWindow && !whatsappWindow.closed) {
      try {
        whatsappWindow.location.href = state.whatsappUrl;
        whatsappWindow.opener = null;
        opened = true;
      } catch {
        // The visible fallback link below still lets the shopkeeper open the draft.
      }
    } else if (whatsappWindow && !whatsappWindow.closed) {
      whatsappWindow.close();
    }
    whatsappWindowRef.current = null;
    setWhatsappOpened(opened);
    setToastVisible(true);

    if (opened) {
      const data = new FormData();
      data.set('booking_id', state.bookingId);
      data.set('kind', 'booking_confirmation');
      void markWhatsAppOpenedAction(data).catch(() => {});
    }

    const delay = opened ? 2600 : state.whatsappUrl ? 6500 : 2600;
    const timer = window.setTimeout(() => {
      setToastVisible(false);
      formRef.current?.reset();
      setLines([blankLine()]);
      setAdvance('0');
      setAdvanceMethod('Cash');
      setNoSmartphone(false);
      setWhatsappOptIn(false);
      setWhatsappOpened(false);
      window.requestAnimationFrame(() => phoneRef.current?.focus());
    }, delay);

    return () => window.clearTimeout(timer);
  }, [state]);

  const updateLine = (index: number, key: keyof QuickLine, value: string) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
  };

  return (
    <>
      {toastVisible && state.bookingId && (
        <div className="booking-success-popup" role="status" aria-live="polite">
          <div className="booking-success-icon">✓</div>
          <div className="booking-success-copy">
            <strong>Booking has been noted</strong>
            <span>
              {state.noSmartphone
                ? 'Booking saved. This customer is marked for a manual phone follow-up when the order is ready.'
                : whatsappOpened
                  ? 'WhatsApp booking-confirmation draft opened. Review it and tap Send; the form will reset shortly.'
                  : state.whatsappUrl
                    ? 'Booking saved. Open the customer confirmation message below, then continue with the next booking.'
                    : 'Booking saved. WhatsApp messages are disabled until the customer agrees to receive updates.'}
            </span>
            {state.warning && <span className="booking-success-warning">{state.warning}</span>}
            {state.whatsappUrl && !whatsappOpened && (
              <a
                href={state.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  const data = new FormData();
                  data.set('booking_id', state.bookingId || '');
                  data.set('kind', 'booking_confirmation');
                  void markWhatsAppOpenedAction(data).catch(() => {});
                }}
              >
                ↗ Open WhatsApp message
              </a>
            )}
            <a href={'/bookings/' + state.bookingId}>View booking details →</a>
          </div>
        </div>
      )}

      <form
        ref={formRef}
        action={action}
        className="card quick-booking-form"
        onSubmit={() => {
          // Only prepare a WhatsApp tab when the customer has opted in and has a smartphone.
          // Navigate only after the booking is successfully saved.
          if (!whatsappOptIn || noSmartphone) {
            whatsappWindowRef.current = null;
            return;
          }
          try {
            whatsappWindowRef.current = window.open('about:blank', '_blank');
          } catch {
            whatsappWindowRef.current = null;
          }
        }}
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

          <div className="quick-contact-preferences">
            <label className="quick-preference-check">
              <input
                type="checkbox"
                name="customer_no_smartphone"
                checked={noSmartphone}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setNoSmartphone(checked);
                  if (checked) setWhatsappOptIn(false);
                }}
              />
              <span>
                <strong>Customer does not have a smartphone</strong>
                <small>Add this customer to the manual phone follow-up list when the order is ready.</small>
              </span>
            </label>
            <label className="quick-preference-check">
              <input
                type="checkbox"
                name="customer_whatsapp_opt_in"
                checked={whatsappOptIn}
                disabled={noSmartphone}
                onChange={(event) => setWhatsappOptIn(event.target.checked)}
              />
              <span>
                <strong>Customer agrees to WhatsApp order updates</strong>
                <small>Required for scheduled pickup messages. Leave unchecked unless the customer has agreed.</small>
              </span>
            </label>
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
          <button className="btn btn-primary quick-save-button" type="submit" disabled={pending}>
            {pending ? 'Saving booking…' : '✓ Save booking'}
          </button>
        </div>
      </form>
    </>
  );
}
