import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { addPaymentAction, createFollowupReminderAction, deleteBookingAction, markWhatsAppSentAction, updateBookingStatusAction, updateWhatsAppConsentAction, verifyItemMrpAction } from '@/lib/actions';
import { dateTimeLabel, inr, statusClass } from '@/lib/format';
import { bookingConfirmationMessage } from '@/lib/messages';
import WhatsAppDraftButton from '@/components/whatsapp-draft-button';

export default async function BookingDetailPage({ params }: { params: Promise<{id:string}> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: booking }, { data: items }, { data: payments }, { data: settlements }, { data: events }, { data: reminders }, { data: settings }] = await Promise.all([
    supabase.from('bookings').select('*').eq('id',id).maybeSingle(),
    supabase.from('booking_items').select('*').eq('booking_id',id).order('created_at'),
    supabase.from('payments').select('*').eq('booking_id',id).order('created_at',{ascending:false}),
    supabase.from('settlements').select('*').eq('booking_id',id).order('created_at',{ascending:false}),
    supabase.from('booking_events').select('*').eq('booking_id',id).order('created_at',{ascending:false}).limit(100),
    supabase.from('reminders').select('*').eq('booking_id',id).order('due_at',{ascending:false}).limit(20),
    supabase.from('shop_settings').select('shop_name,shop_phone,default_footer').maybeSingle(),
  ]);
  if (!booking) notFound();
  const medicineItems = items || [];
  const advanceReceived = (payments||[]).filter((p:any)=>p.payment_type==='advance').reduce((s:number,p:any)=>s+Number(p.amount||0),0);
  const additional = (payments||[]).filter((p:any)=>p.payment_type==='additional').reduce((s:number,p:any)=>s+Number(p.amount||0),0);
  const refunds = (payments||[]).filter((p:any)=>p.payment_type==='refund').reduce((s:number,p:any)=>s+Number(p.amount||0),0);
  const advanceApplied = (settlements||[]).reduce((s:number,p:any)=>s+Number(p.advance_applied||0),0);
  const openWhatsapp = bookingConfirmationMessage(booking,medicineItems,advanceReceived,settings?.shop_name||'Ratan Medical Hall',settings?.default_footer||'Regards,\nRatan Medical Hall');
  const anyUnverified = medicineItems.some((item:any)=>Number(item.collected_quantity)<Number(item.received_quantity)&&(!item.mrp_verified||!item.verified_mrp));
  const contactWasOpened = (events||[]).some((event:any)=>event.event_type==='whatsapp_draft_opened');
  return <>
    <div className="page-heading"><div><div className="kicker">BOOKING DETAIL / {booking.booking_code}</div><h1>{booking.customer_name || 'Customer booking'}</h1><p>{booking.customer_phone} · Created {dateTimeLabel(booking.created_at)} · Booking ID {booking.booking_code}</p></div><div className="inline-form"><Link href="/bookings" className="btn btn-secondary">← All bookings</Link><Link href={`/bookings/${id}/settlement`} className="btn btn-primary">Record pickup / settlement →</Link><form action={deleteBookingAction} onSubmit={undefined}><input type="hidden" name="booking_id" value={id}/><button className="btn btn-danger" type="submit">Delete booking</button></form></div></div>
    <div className="grid-2" style={{alignItems:'start'}}>
      <div className="stack">
        <section className="card">
          <div className="card-header"><div><div className="card-title">Medicine items</div><div className="card-description">Stock and sale-price verification are tracked per product line.</div></div><span className={statusClass(booking.status)}>{booking.status}</span></div>
          <div className="table-wrap"><table><thead><tr><th>Medicine</th><th>Requested</th><th>Received</th><th>Collected</th></tr></thead><tbody>{medicineItems.map((item:any)=><tr key={item.id}><td><div className="table-primary">{item.product_name}</div><div className="table-secondary">{[item.strength,item.dosage_form,item.brand,item.pack_size].filter(Boolean).join(' · ')||'Product details not specified'}</div><div style={{marginTop:8}}><span className={item.mrp_verified?'status status-green':'status status-amber'}>{item.mrp_verified?'MRP verified':'MRP needs verification'}</span></div>
                <form action={verifyItemMrpAction} className="inline-form" style={{marginTop:8,flexWrap:'wrap'}}><input type="hidden" name="booking_id" value={id}/><input type="hidden" name="item_id" value={item.id}/><input className="input" name="verified_mrp" type="number" step="0.01" min="0.01" defaultValue={item.verified_mrp??''} placeholder="Verified MRP ₹" style={{width:135,padding:'7px 9px',fontSize:11}} required/><label className="check-line"><input type="checkbox" name="mrp_verified" required/> Confirm MRP</label><button className="btn btn-secondary btn-small" type="submit">Save MRP</button></form>
              </td><td>{item.requested_quantity} <span className="muted">{item.unit_label}</span></td><td>{item.received_quantity}</td><td>{item.collected_quantity}</td></tr>)}</tbody></table></div>
          {anyUnverified&&<div style={{padding:'0 18px 18px'}}><div className="notice notice-amber">A product's MRP must be verified before it can be included in a settlement. Purchase rate and MRP are not interchangeable.</div></div>}
          <div className="form-section"><div className="field"><label>Shopkeeper status override</label><form action={updateBookingStatusAction} className="inline-form" style={{flexWrap:'wrap'}}><input type="hidden" name="booking_id" value={id}/><select className="select" name="status" defaultValue={booking.status} style={{maxWidth:260}}>{['Awaiting Stock','Partially Received','Ready for Pickup','Partially Collected','Completed','Cancelled','Returned / Refunded'].map((s)=><option key={s}>{s}</option>)}</select><button className="btn btn-secondary" type="submit">Update status</button></form><small>Ready for Pickup and Completed status changes are validated against received / collected quantities.</small></div></div>
        </section>
        <section className="card"><div className="card-header"><div><div className="card-title">Activity timeline</div><div className="card-description">Recorded booking, payment, stock and message events.</div></div></div><div className="card-pad"><div className="timeline">{(events||[]).length?(events||[]).map((event:any)=><div className="timeline-item" key={event.id}><div className="timeline-dot"/><div><div className="timeline-title">{event.summary}</div><div className="timeline-date">{dateTimeLabel(event.created_at)} · {event.event_type.replaceAll('_',' ')}</div></div></div>):<div className="muted small">No events recorded yet.</div>}</div></div></section>
      </div>
      <div className="stack">
        <section className="card card-pad"><div className="split-header"><div className="card-title">Booking summary</div><span className={statusClass(booking.status)}>{booking.status}</span></div><div className="divider"/><div className="money-row"><span className="muted">Advance received</span><b>{inr(advanceReceived)}</b></div><div className="money-row"><span className="muted">Advance applied</span><b>{inr(advanceApplied)}</b></div><div className="money-row"><span className="muted">Additional payments</span><b>{inr(additional)}</b></div><div className="money-row"><span className="muted">Refund payments</span><b>{inr(refunds)}</b></div><div className="money-row"><span className="muted">Last contact (manual confirmation)</span><b>{dateTimeLabel(booking.last_contact_at)}</b></div><div className="money-row"><span className="muted">Last draft opened</span><b>{dateTimeLabel(booking.last_whatsapp_draft_opened_at)}</b></div><div className="money-row"><span className="muted">Unused advance (before refunds)</span><b>{inr(Math.max(0,advanceReceived-advanceApplied-refunds))}</b></div>{booking.notes&&<div className="notice notice-neutral" style={{marginTop:12}}>{booking.notes}</div>}</section>
        <section className="card card-pad">
          <div className="card-title">Customer WhatsApp permission</div>
          <div className="card-description">Record the customer's explicit choice. Existing bookings remain unconfirmed until you record it here.</div>
          <div className="money-row">
            <span className="muted">Current choice</span>
            <span className={booking.whatsapp_consent === true ? 'status status-green' : booking.whatsapp_consent === false ? 'status status-red' : 'status status-amber'}>
              {booking.whatsapp_consent === true ? 'Agreed' : booking.whatsapp_consent === false ? 'Not agreed' : 'Not recorded'}
            </span>
          </div>
          <form action={updateWhatsAppConsentAction} className="stack" style={{gap:10,marginTop:10}}>
            <input type="hidden" name="booking_id" value={id}/>
            <div className="field">
              <label htmlFor="booking_whatsapp_consent">Customer's choice</label>
              <select
                className="select"
                id="booking_whatsapp_consent"
                name="whatsapp_consent"
                defaultValue={booking.whatsapp_consent === true ? 'yes' : booking.whatsapp_consent === false ? 'no' : ''}
                required
              >
                <option value="">Select the customer's choice</option>
                <option value="yes">Customer agreed</option>
                <option value="no">Customer did not agree</option>
              </select>
            </div>
            <button className="btn btn-secondary" type="submit">Save consent choice</button>
          </form>
          <div className="divider"/>
          <div className="card-title">WhatsApp Messenger message</div>
          <div className="card-description">Opening a draft does not mean it was sent. The shopkeeper must review and send manually.</div>
          {booking.whatsapp_consent === true ? <>
            <div className="inline-form" style={{marginTop:15,flexWrap:'wrap'}}>
              <WhatsAppDraftButton bookingId={id} phone={booking.customer_phone} message={openWhatsapp} kind="booking_confirmation" label="Open draft in WhatsApp Messenger"/>
              <form action={markWhatsAppSentAction}>
                <input type="hidden" name="booking_id" value={id}/>
                <input type="hidden" name="kind" value="booking_confirmation"/>
                <input type="hidden" name="return_path" value={`/bookings/${id}`}/>
                <button className="btn btn-secondary" type="submit">Mark sent (manual confirmation)</button>
              </form>
            </div>
            <div className="notice notice-neutral" style={{marginTop:12}}>{contactWasOpened?'A WhatsApp Messenger draft was opened. Sending is not confirmed until the shopkeeper marks it as sent.':'Status: Draft not yet opened. The shopkeeper reviews and sends it manually in WhatsApp Messenger.'}</div>
          </> : <div className="notice notice-amber" style={{marginTop:12}}>
            {booking.whatsapp_consent === false ? 'The customer did not agree to WhatsApp messages.' : 'WhatsApp consent has not been recorded for this booking.'}
            {' '}Draft and mark-sent actions are unavailable until consent is recorded as Agreed.
          </div>}
        </section>
        <section className="card"><div className="card-header"><div><div className="card-title">Record a payment</div><div className="card-description">Payments and refunds stay in the ledger.</div></div></div><form action={addPaymentAction} className="form-section stack" style={{gap:12}}><input type="hidden" name="booking_id" value={id}/><div className="form-grid"><div className="field"><label>Type</label><select className="select" name="payment_type"><option value="advance">Advance received</option><option value="additional">Additional payment</option><option value="refund">Refund paid</option></select></div><div className="field"><label>Amount (₹)</label><input className="input" type="number" min="0.01" max="10000000" step="0.01" name="amount" placeholder="0.00" required/></div><div className="field"><label>Method</label><select className="select" name="method"><option>Cash</option><option>UPI</option><option>Card</option><option>Bank transfer</option><option>Other</option></select></div><div className="field"><label>Note</label><input className="input" name="note" placeholder="Optional note" maxLength={500}/></div></div><button className="btn btn-primary" type="submit">Save payment record</button></form></section>
        <section className="card"><div className="card-header"><div><div className="card-title">Follow-up reminders</div><div className="card-description">Create a manual follow-up task.</div></div></div><form action={createFollowupReminderAction} className="form-section stack" style={{gap:11}}><input type="hidden" name="booking_id" value={id}/><div className="field"><label>Reminder reason</label><select className="select" name="reason"><option>Customer follow-up</option><option>Check expected stock arrival</option><option>Pickup reminder</option><option>Settlement follow-up</option><option>Review invoice match</option></select></div><div className="field"><label>Due date and time</label><input className="input" type="datetime-local" name="due_at" required/></div><button className="btn btn-secondary" type="submit">＋ Add reminder</button></form>{(reminders||[]).length>0&&<div style={{padding:'0 18px 16px'}} className="small muted">{reminders?.length} reminder(s) recorded for this booking.</div>}</section>
      </div>
    </div>
  </>;
}
