import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { dateTimeLabel, inr, statusClass } from '@/lib/format';
export default async function SettlementsPage(){
 const supabase=await createClient();
 const [{data:settlements},{data:bookings},{data:payments}]=await Promise.all([
  supabase.from('settlements').select('*').order('created_at',{ascending:false}).limit(500),
  supabase.from('bookings').select('id,booking_code,customer_name,customer_phone,status'),
  supabase.from('payments').select('booking_id,payment_type,amount').in('payment_type',['advance','additional','refund']),
 ]);
 const bookingMap=new Map((bookings||[]).map((b:any)=>[b.id,b]));
 const balanceDue=(settlements||[]).filter((s:any)=>Number(s.balance_due)>0);
 const refundDue=(settlements||[]).filter((s:any)=>Number(s.refund_due)>0);
 const totalBalance=balanceDue.reduce((s:number,x:any)=>s+Number(x.balance_due),0);
 const totalRefund=refundDue.reduce((s:number,x:any)=>s+Number(x.refund_due),0);
 return <><div className="page-heading"><div><div className="kicker">PAYMENT LEDGER</div><h1>Settlements</h1><p>Review saved pickup settlements, amounts payable, and refunds due. Record payments and refunds from the related booking so the ledger remains auditable.</p></div></div>
  <div className="stats-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}><div className="stat-card"><div className="stat-top">Settlements recorded</div><div className="stat-value">{(settlements||[]).length}</div><div className="stat-foot">Each record stores itemized quantities and pricing</div></div><div className="stat-card"><div className="stat-top">Balance payable</div><div className="stat-value" style={{fontSize:24}}>{inr(totalBalance)}</div><div className="stat-foot">Across recorded settlement balances</div></div><div className="stat-card"><div className="stat-top">Refund due</div><div className="stat-value" style={{fontSize:24}}>{inr(totalRefund)}</div><div className="stat-foot">Not counted as paid until recorded</div></div></div>
  <section className="card"><div className="card-header"><div><div className="card-title">Settlement history</div><div className="card-description">Most recent settlement records first.</div></div></div>
   {(settlements||[]).length?<div className="table-wrap"><table><thead><tr><th>Booking / customer</th><th>Created</th><th>Net sale</th><th>Advance applied</th><th>Balance / refund</th><th>Status</th><th /></tr></thead><tbody>{(settlements||[]).map((s:any)=>{const b:any=bookingMap.get(s.booking_id);return <tr key={s.id}><td><div className="table-primary">{b?.booking_code||'Booking'}</div><div className="table-secondary">{b?.customer_name||b?.customer_phone||'Customer'}</div></td><td>{dateTimeLabel(s.created_at)}</td><td>{inr(s.net_sale_value)}</td><td>{inr(s.advance_applied)}</td><td>{Number(s.balance_due)>0?<span style={{color:'#a6382f',fontWeight:750}}>{inr(s.balance_due)} due</span>:Number(s.refund_due)>0?<span style={{color:'#a6382f',fontWeight:750}}>{inr(s.refund_due)} refund</span>:inr(0)}</td><td><span className={statusClass(s.status)}>{s.status}</span></td><td><Link className="btn btn-secondary btn-small" href={`/settlements/${s.id}`}>Open →</Link></td></tr>})}</tbody></table></div>:<div className="empty-state"><div className="empty-icon">₹</div><div className="empty-title">No settlements recorded</div><div className="empty-copy">After medicine stock is received, open a booking and record pickup to calculate the verified sale amount and settlement.</div><Link href="/ready" className="btn btn-primary">Review pickup queue</Link></div>}
  </section>
  <div className="notice notice-neutral" style={{marginTop:16}}>Payment and settlement histories are separate on purpose: advance received is not the same as advance applied. A negative balance creates a refund due; record the actual refund after it is paid.</div>
 </>;
}
