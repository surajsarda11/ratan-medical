import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SettlementForm from '@/components/settlement-form';
import { inr, statusClass } from '@/lib/format';
export default async function CreateSettlementPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params; const supabase=await createClient();
  const [{data:booking},{data:items},{data:payments},{data:settlements}]=await Promise.all([
    supabase.from('bookings').select('*').eq('id',id).maybeSingle(),
    supabase.from('booking_items').select('*').eq('booking_id',id).order('created_at'),
    supabase.from('payments').select('payment_type,amount').eq('booking_id',id),
    supabase.from('settlements').select('advance_applied').eq('booking_id',id),
  ]);
  if(!booking)notFound();
  if(['Cancelled','Returned / Refunded'].includes(booking.status)) return <><div className="page-heading"><div><h1>Settlement unavailable</h1><p>This booking is cancelled or returned. Review its payment ledger before making a refund or credit adjustment.</p></div></div><Link href={`/bookings/${id}`} className="btn btn-secondary">← Back to booking</Link></>;
  const advancePaid=(payments||[]).filter((p:any)=>p.payment_type==='advance').reduce((s:number,p:any)=>s+Number(p.amount||0),0);
  const advanceRefunded=(payments||[]).filter((p:any)=>p.payment_type==='refund').reduce((s:number,p:any)=>s+Number(p.amount||0),0);
  const priorApplied=(settlements||[]).reduce((s:number,p:any)=>s+Number(p.advance_applied||0),0);
  const availableAdvance=Math.max(0,advancePaid-advanceRefunded-priorApplied);
  const availableQty=(items||[]).reduce((s:number,i:any)=>s+Math.max(0,Number(i.received_quantity||0)-Number(i.collected_quantity||0)),0);
  return <><div className="page-heading"><div><div className="kicker">PICKUP AND FINANCIAL REVIEW</div><h1>Settle {booking.booking_code}</h1><p>{booking.customer_name||'Customer'} · {booking.customer_phone}. Only verify the quantities being handed over now. The final message is editable before it is sent.</p></div><Link href={`/bookings/${id}`} className="btn btn-secondary">← Booking details</Link></div>
    {!availableQty&&<div className="notice notice-amber" style={{marginBottom:16}}>No uncollected received quantity is available. Use Purchase CSV Import to record incoming stock first, or review the booking's collection history.</div>}
    <div className="stats-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}><div className="stat-card"><div className="stat-top">Advance received</div><div className="stat-value" style={{fontSize:24}}>{inr(advancePaid)}</div><div className="stat-foot">Total recorded advance payments</div></div><div className="stat-card"><div className="stat-top">Advance available to apply</div><div className="stat-value" style={{fontSize:24}}>{inr(availableAdvance)}</div><div className="stat-foot">After previous settlement allocations</div></div><div className="stat-card"><div className="stat-top">Quantity available for pickup</div><div className="stat-value" style={{fontSize:24}}>{availableQty}</div><div className="stat-foot">All medicine lines combined</div></div></div>
    <SettlementForm bookingId={id} items={items||[]} availableAdvance={availableAdvance}/>
    <p className="muted tiny" style={{marginTop:13}}>This creates an internal settlement record and itemized WhatsApp draft; it is not a formal tax invoice. The shopkeeper remains responsible for statutory billing and dispensing checks.</p>
  </>;
}
