import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MessageEditor from '@/components/message-editor';
import { dateTimeLabel, inr, statusClass } from '@/lib/format';
import { prepareSettlementMessage } from '@/lib/messages';
export default async function SettlementDetailPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params; const supabase=await createClient();
  const {data:settlement}=await supabase.from('settlements').select('*').eq('id',id).maybeSingle();
  if(!settlement)notFound();
  const [{data:booking},{data:settings}]=await Promise.all([
    supabase.from('bookings').select('id,booking_code,customer_name,customer_phone,status,whatsapp_consent').eq('id',settlement.booking_id).maybeSingle(),
    supabase.from('shop_settings').select('shop_phone').maybeSingle(),
  ]);
  if(!booking)notFound();
  const lines=Array.isArray(settlement.items_json)?settlement.items_json:[];
  const customerMessage=prepareSettlementMessage(settlement.message_text, booking.status);
  return <><div className="page-heading"><div><div className="kicker">SETTLEMENT RECORD</div><h1>{booking.status==='Completed'?'Delivery completed & bill':'Settlement summary'}</h1><p>{booking.booking_code} · {booking.customer_name||'Customer'} · saved {dateTimeLabel(settlement.created_at)}</p></div><div className="inline-form"><Link href={`/bookings/${booking.id}`} className="btn btn-secondary">← Booking</Link><span className={statusClass(settlement.status)}>{settlement.status}</span></div></div>
    <div className="grid-2" style={{alignItems:'start'}}><div className="stack">
      <section className="card"><div className="card-header"><div><div className="card-title">Itemized sale</div><div className="card-description">This is a settlement summary, not a formal tax invoice.</div></div></div><div className="table-wrap"><table><thead><tr><th>Medicine</th><th>Qty</th><th>Verified MRP</th><th>Line total</th></tr></thead><tbody>{lines.map((line:any,index:number)=><tr key={line.item_id||index}><td><div className="table-primary">{line.product_name}</div><div className="table-secondary">{[line.strength,line.dosage_form,line.brand,line.pack_size].filter(Boolean).join(' · ')}</div></td><td>{line.quantity} {line.unit_label}</td><td>{inr(line.mrp)}</td><td><b>{inr(line.amount)}</b></td></tr>)}</tbody></table></div><div className="card-pad"><div className="money-row money-total"><span>Sale total</span><b>{inr(settlement.net_sale_value)}</b></div><div className="divider"/><div className="money-row"><span className="muted">Advance applied</span><b>− {inr(settlement.advance_applied)}</b></div><div className="money-row"><span className="muted">Additional payment</span><b>− {inr(settlement.additional_payment)}</b></div>{Number(settlement.balance_due)>0&&<div className="money-row"><span>Balance payable</span><b style={{color:'#a6382f'}}>{inr(settlement.balance_due)}</b></div>}{Number(settlement.refund_due)>0&&<div className="money-row"><span>Refund due (not yet paid)</span><b style={{color:'#a6382f'}}>{inr(settlement.refund_due)}</b></div>}</div></section>
      <div className="notice notice-amber">Please verify the item quantities, MRP and customer contact before sending. The WhatsApp Messenger draft must be reviewed and sent manually.</div>
    </div><div className="stack"><MessageEditor settlementId={id} bookingId={booking.id} phone={booking.customer_phone} initialMessage={customerMessage} whatsappAllowed={booking.whatsapp_consent === true}/><section className="card card-pad"><div className="card-title">Settlement status</div><div className="card-description">{settlement.status==='Settled'?'No payment balance remains for this pickup.':settlement.status==='Balance Due'?'A customer balance remains to be collected. Record it in the booking payment ledger when received.':'A refund is due. Record the refund only after it is actually paid to the customer.'}</div><div className="divider"/><Link href={`/bookings/${booking.id}`} className="btn btn-secondary">Open booking payment ledger →</Link></section></div></div>
  </>;
}
