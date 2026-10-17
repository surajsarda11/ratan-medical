'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { dateLabel, inr, statusClass } from '@/lib/format';

export default function BookingsTable({ bookings, advancesByBooking = {} }: { bookings: any[]; advancesByBooking?: Record<string, number> }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All statuses');
  const [range, setRange] = useState('all');
  const filtered = useMemo(() => bookings.filter((b) => {
    const medicineText = (b.booking_items || []).map((i: any) => `${i.product_code || ''} ${i.product_name} ${i.strength || ''} ${i.pack_size || ''}`).join(' ');
    const hay = `${b.booking_code} ${b.customer_name || ''} ${b.customer_phone} ${medicineText}`.toLowerCase();
    if (query && !hay.includes(query.toLowerCase().trim())) return false;
    if (status !== 'All statuses' && b.status !== status) return false;
    if (range === '7days' && (Date.now() - new Date(b.created_at).getTime()) > 7*86400000) return false;
    if (range === '30days' && (Date.now() - new Date(b.created_at).getTime()) > 30*86400000) return false;
    return true;
  }), [bookings, query, status, range]);
  return <div className="card">
    <div className="card-header"><div><div className="card-title">Bookings</div><div className="card-description">{filtered.length} shown of {bookings.length} records</div></div><Link href="/bookings/new" className="btn btn-primary btn-small">＋ New booking</Link></div>
    <div style={{padding:'15px 18px'}} className="search-row">
      <input aria-label="Search bookings" className="input" placeholder="Search booking, customer, phone, barcode or medicine…" value={query} onChange={(e)=>setQuery(e.target.value)} />
      <select aria-label="Filter by status" className="select" value={status} onChange={(e)=>setStatus(e.target.value)}><option>All statuses</option>{['Awaiting Stock','Partially Received','Ready for Pickup','Partially Collected','Completed','Cancelled','Returned / Refunded'].map((s)=><option key={s}>{s}</option>)}</select>
      <select aria-label="Filter by booking date" className="select" value={range} onChange={(e)=>setRange(e.target.value)}><option value="all">Any date</option><option value="7days">Last 7 days</option><option value="30days">Last 30 days</option></select>
    </div>
    {filtered.length ? <div className="table-wrap"><table><thead><tr><th>Booking / date</th><th>Customer</th><th>Medicine</th><th>Qty received</th><th>Advance</th><th>Status</th><th /></tr></thead><tbody>{filtered.map((b:any)=>{
      const requested = (b.booking_items||[]).reduce((s:number,i:any)=>s+Number(i.requested_quantity||0),0);
      const received = (b.booking_items||[]).reduce((s:number,i:any)=>s+Number(i.received_quantity||0),0);
      return <tr key={b.id}><td><Link href={`/bookings/${b.id}`}><div className="table-primary">{b.booking_code}</div><div className="table-secondary">{dateLabel(b.created_at)}</div></Link></td><td><div className="table-primary">{b.customer_name||'Customer'}</div><div className="table-secondary">{b.customer_phone}</div></td><td><div className="table-primary">{b.booking_items?.[0]?.product_name || '—'}</div><div className="table-secondary">{Math.max(0,(b.booking_items?.length||0)-1)} more item(s)</div></td><td>{received} / {requested}</td><td>{inr(advancesByBooking[b.id]||0)}</td><td><span className={statusClass(b.status)}>{b.status}</span></td><td><Link className="btn btn-secondary btn-small" href={`/bookings/${b.id}`}>Open →</Link></td></tr>;
    })}</tbody></table></div> : <div className="empty-state"><div className="empty-icon">⌕</div><div className="empty-title">No bookings match these filters</div><div className="empty-copy">Try a different status or clear your search.</div><button className="btn btn-secondary" onClick={()=>{setQuery('');setStatus('All statuses');setRange('all')}}>Clear filters</button></div>}
  </div>;
}
