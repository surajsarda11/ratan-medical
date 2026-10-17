'use client';

import { useMemo, useState } from 'react';
import { useActionState } from 'react';
import { createStaffBookingAction, type ActionState } from '@/lib/actions';

type Line = {
  product_name: string;
  requested_quantity: string;
  unit_label: string;
  strength: string;
  brand: string;
  pack_size: string;
};
const blankLine = (): Line => ({
  product_name: '',
  requested_quantity: '1',
  unit_label: 'packs',
  strength: '',
  brand: '',
  pack_size: '',
});

export default function StaffQuickBookingForm() {
  const [state, action, pending] = useActionState(createStaffBookingAction, {} as ActionState);
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [advance, setAdvance] = useState('0');
  const itemsJson = useMemo(
    () => JSON.stringify(lines.map((line) => ({ ...line, requested_quantity: Number(line.requested_quantity) }))),
    [lines],
  );

  const updateLine = (index: number, key: keyof Line, value: string) =>
    setLines((previous) => previous.map((line, i) => i === index ? { ...line, [key]: value } : line));

  return <form
    action={action}
    onSubmit={(event) => {
      const amount = Number(advance || 0);
      if (Number.isFinite(amount) && amount > 0 && !window.confirm(`Confirm that you received ₹${amount.toFixed(2)} as an advance for this booking?`)) {
        event.preventDefault();
      }
    }}
    className="card"
  >
    <div className="form-section">
      <div className="section-head">
        <div className="section-number">01</div>
        <div><div className="section-head-title">Customer mobile number *</div><div className="section-head-sub">Used to identify and contact the customer about this booking.</div></div>
      </div>
      <div className="field">
        <label htmlFor="staff_customer_phone">Mobile number</label>
        <input className="input" id="staff_customer_phone" name="customer_phone" placeholder="10-digit mobile number" inputMode="tel" autoComplete="tel" required pattern="[+0-9 ()-]{10,20}" />
        <small>Enter 10 digits, or include +91.</small>
      </div>
    </div>

    <div className="form-section">
      <div className="section-head">
        <div className="section-number">02</div>
        <div><div className="section-head-title">Medicine requested *</div><div className="section-head-sub">Enter the exact product requested. Verify strength, formulation and pack before supplying; similar names are not interchangeable.</div></div>
      </div>
      {lines.map((line, index) => <div className="medicine-line" key={index}>
        <div className="medicine-line-title">
          <span>Medicine {index + 1}</span>
          {lines.length > 1 && <button className="btn btn-danger btn-small" type="button" onClick={() => setLines((previous) => previous.filter((_, i) => i !== index))}>Remove</button>}
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor={`staff_product_name_${index}`}>Product name *</label>
            <input className="input" id={`staff_product_name_${index}`} value={line.product_name} onChange={(event) => updateLine(index, 'product_name', event.target.value)} placeholder="Medicine / product name" maxLength={180} required />
          </div>
          <div className="form-grid-3" style={{ alignItems: 'end' }}>
            <div className="field">
              <label htmlFor={`staff_quantity_${index}`}>Quantity *</label>
              <input className="input" id={`staff_quantity_${index}`} type="number" min="0.001" max="100000" step="0.001" value={line.requested_quantity} onChange={(event) => updateLine(index, 'requested_quantity', event.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor={`staff_unit_${index}`}>Unit</label>
              <select className="select" id={`staff_unit_${index}`} value={line.unit_label} onChange={(event) => updateLine(index, 'unit_label', event.target.value)}>
                <option value="packs">Packs</option><option value="strips">Strips</option><option value="bottles">Bottles</option><option value="boxes">Boxes</option><option value="tablets">Tablets</option><option value="tubes">Tubes</option><option value="units">Units</option>
              </select>
            </div>
          </div>
        </div>
        <details style={{ marginTop: 10 }}>
          <summary className="field-label" style={{ cursor: 'pointer', color: '#315b43', fontWeight: 700 }}>Add optional product details</summary>
          <div className="form-grid-3" style={{ marginTop: 12 }}>
            <div className="field"><label htmlFor={`staff_strength_${index}`}>Strength</label><input className="input" id={`staff_strength_${index}`} value={line.strength} onChange={(event) => updateLine(index, 'strength', event.target.value)} placeholder="e.g. 500 mg" maxLength={80} /></div>
            <div className="field"><label htmlFor={`staff_brand_${index}`}>Brand / manufacturer</label><input className="input" id={`staff_brand_${index}`} value={line.brand} onChange={(event) => updateLine(index, 'brand', event.target.value)} placeholder="If specified" maxLength={120} /></div>
            <div className="field"><label htmlFor={`staff_pack_${index}`}>Pack size</label><input className="input" id={`staff_pack_${index}`} value={line.pack_size} onChange={(event) => updateLine(index, 'pack_size', event.target.value)} placeholder="e.g. 10 tablets / strip" maxLength={80} /></div>
          </div>
        </details>
      </div>)}
      <input type="hidden" name="items_json" value={itemsJson} />
      <button className="btn btn-secondary" type="button" style={{ marginTop: 13 }} disabled={lines.length >= 20} onClick={() => setLines((previous) => [...previous, blankLine()])}>＋ Add another medicine</button>
    </div>

    <div className="form-section">
      <details>
        <summary style={{ cursor: 'pointer', color: '#315b43', fontWeight: 750 }}>Optional details — customer name, note or advance</summary>
        <div className="stack" style={{ gap: 14, marginTop: 14 }}>
          <div className="field"><label htmlFor="staff_customer_name">Customer name</label><input className="input" id="staff_customer_name" name="customer_name" placeholder="Optional" maxLength={120} /></div>
          <div className="field"><label htmlFor="staff_notes">Booking note</label><input className="input" id="staff_notes" name="notes" placeholder="Optional note for the owner / team" maxLength={500} /></div>
          <div className="form-grid">
            <div className="field"><label htmlFor="staff_advance">Advance received (₹)</label><input className="input" id="staff_advance" name="advance_amount" type="number" min="0" max="10000000" step="0.01" value={advance} onChange={(event) => setAdvance(event.target.value)} /></div>
            <div className="field"><label htmlFor="staff_advance_method">Payment method</label><select className="select" id="staff_advance_method" name="advance_method"><option>Cash</option><option>UPI</option><option>Card</option><option>Bank transfer</option><option>Other</option></select></div>
          </div>
        </div>
      </details>
    </div>

    {state.error && <div style={{ padding: '0 21px 18px' }}><div className="error-text">{state.error}</div></div>}
    {state.success && <div style={{ padding: '0 21px 18px' }}><div className="notice notice-green"><strong>{state.success}</strong>{state.whatsappUrl && <div style={{ marginTop: 9 }}><a className="btn btn-secondary btn-small" href={state.whatsappUrl} target="_blank" rel="noreferrer">Open WhatsApp draft ↗</a></div>}<p className="tiny" style={{ marginBottom: 0, marginTop: 8 }}>The booking is saved. WhatsApp is a draft only; check the recipient and send manually.</p></div></div>}
    <div className="sticky-actions">
      <a className="btn btn-secondary" href="/staff-booking">Reset / cancel</a>
      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Saving booking…' : 'Save booking →'}</button>
    </div>
  </form>;
}
