import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { dateLabel, inr, statusClass } from '@/lib/format';

export default async function DashboardPage() {
  const supabase = await createClient();
  const [{ data: summaryData, error: summaryError }, { data: recentBookings }] = await Promise.all([
    supabase.rpc('get_dashboard_summary'),
    supabase.from('bookings').select('id,booking_code,customer_name,customer_phone,status,created_at,booking_items(id,product_name,strength,pack_size,requested_quantity,received_quantity,unit_label)').order('created_at',{ascending:false}).limit(8),
  ]);
  const summary: any = summaryData || {};
  const allBookings = recentBookings || [];
  const stats = [
    { label:'Active bookings', value:Number(summary.active_bookings||0).toLocaleString('en-IN'), foot:'Open customer orders', icon:'▤' },
    { label:'Awaiting stock', value:Number(summary.awaiting_stock||0).toLocaleString('en-IN'), foot:`${Number(summary.partially_received||0)} partially received`, icon:'◷' },
    { label:'Ready for pickup', value:Number(summary.ready_for_pickup||0).toLocaleString('en-IN'), foot:'Fully received orders', icon:'✓' },
    { label:'Overdue reminders', value:Number(summary.overdue_reminders||0).toLocaleString('en-IN'), foot:'Needs a follow-up', icon:'⚑' },
    { label:'Advances held', value:inr(Number(summary.advances_held||0)), foot:'Active booking advances not yet applied / refunded', icon:'₹' },
    { label:'Outstanding balance', value:inr(Number(summary.outstanding_balance||0)), foot:'Customer balances due across settlements', icon:'⇄' },
    { label:'Refunds due', value:inr(Number(summary.refund_due||0)), foot:'Resolve refunds and credits', icon:'↩' },
    { label:'Needs invoice review', value:Number(summary.needs_invoice_review||0).toLocaleString('en-IN'), foot:'Rows not fully allocated', icon:'⇧' },
    { label:'All-time bookings', value:Number(summary.total_bookings||0).toLocaleString('en-IN'), foot:'Stored booking records', icon:'◫' },
  ];
  return <>
    {summaryError&&<div className="notice notice-amber" style={{marginBottom:16}}>Dashboard totals could not be loaded. Confirm that the Supabase migration completed successfully, then refresh. Until then, summary values may show zero.</div>}
    <div className="page-heading"><div><div className="kicker">OVERVIEW</div><h1>Good day. Here’s the shop pulse.</h1><p>Track orders from booking through arrival, pickup and final settlement — all in one place.</p></div><Link className="btn btn-primary" href="/bookings/new">＋ New booking</Link></div>
    <section className="stats-grid">
      {stats.map((stat) => <div className="stat-card" key={stat.label}><div className="stat-top"><span>{stat.label}</span><span className="stat-icon">{stat.icon}</span></div><div className="stat-value">{stat.value}</div><div className="stat-foot">{stat.foot}</div></div>)}
    </section>
    <div className="grid-2">
      <section className="card">
        <div className="card-header"><div><div className="card-title">Recent bookings</div><div className="card-description">Most recent orders added to the shop</div></div><Link href="/bookings" className="btn btn-secondary btn-small">View all →</Link></div>
        {allBookings.length ? <div className="table-wrap"><table><thead><tr><th>Booking / customer</th><th>Medicine</th><th>Status</th><th>Booked</th></tr></thead><tbody>
          {allBookings.map((b: any) => <tr key={b.id}><td><Link href={`/bookings/${b.id}`}><div className="table-primary">{b.booking_code}</div><div className="table-secondary">{b.customer_name || 'Customer'} · {b.customer_phone}</div></Link></td><td><div className="table-primary">{b.booking_items?.[0]?.product_name || 'Medicine'}</div><div className="table-secondary">{b.booking_items?.length || 0} item(s)</div></td><td><span className={statusClass(b.status)}>{b.status}</span></td><td>{dateLabel(b.created_at)}</td></tr>)}
        </tbody></table></div> : <div className="empty-state"><div className="empty-icon">＋</div><div className="empty-title">Your first booking starts here</div><div className="empty-copy">Record a medicine request and advance, then use the dashboard to track what arrives and what remains to settle.</div><Link href="/bookings/new" className="btn btn-primary">Create first booking</Link></div>}
      </section>
      <div className="stack">
        <section className="card card-pad"><div className="card-title">Quick actions</div><div className="card-description">Common tasks, close at hand.</div><div className="stack" style={{gap:9,marginTop:16}}>
          <Link className="btn btn-secondary" style={{justifyContent:'flex-start'}} href="/bookings/new"><span>＋</span> Register a medicine booking <span style={{marginLeft:'auto'}}>→</span></Link>
          <Link className="btn btn-secondary" style={{justifyContent:'flex-start'}} href="/imports"><span>⇧</span> Import supplier purchase CSV <span style={{marginLeft:'auto'}}>→</span></Link>
          <Link className="btn btn-secondary" style={{justifyContent:'flex-start'}} href="/ready"><span>✓</span> Review pickup queue <span style={{marginLeft:'auto'}}>→</span></Link>
          <Link className="btn btn-secondary" style={{justifyContent:'flex-start'}} href="/reminders"><span>◷</span> Open follow-up reminders <span style={{marginLeft:'auto'}}>→</span></Link>
        </div></section>
        <section className="card card-pad"><div className="split-header"><div className="card-title">Attention needed</div><span className="status status-amber">Live from records</span></div><div className="divider" />
          <div className="money-row"><span className="muted">Reminders past due</span><b>{Number(summary.overdue_reminders||0)}</b></div><div className="money-row"><span className="muted">Invoice rows needing review</span><b>{Number(summary.needs_invoice_review||0)}</b></div><div className="money-row"><span className="muted">Partially received bookings</span><b>{Number(summary.partially_received||0)}</b></div><div className="money-row"><span className="muted">Refunds due</span><b>{inr(Number(summary.refund_due||0))}</b></div>
          <div className="notice notice-neutral" style={{marginTop:13}}>WhatsApp links create drafts only. Record a contact after you have actually reviewed and handled the message.</div>
        </section>
      </div>
    </div>
  </>;
}
