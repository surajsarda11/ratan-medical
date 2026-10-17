import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import InvoiceRowReview from '@/components/invoice-row-review';
import { dateLabel, statusClass } from '@/lib/format';
import { compareInvoiceRow } from '@/lib/matching';
export default async function ImportReviewPage({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;const supabase=await createClient();
 const [{data:imp},{data:rows},{data:items},{data:bookings}]=await Promise.all([
  supabase.from('purchase_imports').select('*').eq('id',id).maybeSingle(),
  supabase.from('purchase_import_rows').select('*').eq('import_id',id).order('row_number'),
  supabase.from('booking_items').select('*').order('created_at',{ascending:false}).limit(3000),
  supabase.from('bookings').select('id,booking_code,customer_name,customer_phone,status').order('created_at',{ascending:false}).limit(1500),
 ]);
 if(!imp)notFound();
 const bookingMap=new Map((bookings||[]).map((b:any)=>[b.id,b]));
 const activeItems=(items||[]).filter((item:any)=>{const b:any=bookingMap.get(item.booking_id);return b&&!['Completed','Cancelled','Returned / Refunded'].includes(b.status);}).map((item:any)=>({...item,bookings:bookingMap.get(item.booking_id)}));
 const outstandingRows=(rows||[]).filter((row:any)=>!['Ignored','Allocated'].includes(row.review_status));
 return <><div className="page-heading"><div><div className="kicker">IMPORT RECONCILIATION</div><h1>{imp.invoice_number||imp.file_name}</h1><p>{imp.supplier_name||'Supplier not specified'} · Invoice {dateLabel(imp.invoice_date)} · Uploaded {dateLabel(imp.created_at)}. Preview and manually approve stock allocations below.</p></div><Link href="/imports" className="btn btn-secondary">← Import history</Link></div>
  <div className="stats-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}><div className="stat-card"><div className="stat-top">Invoice rows</div><div className="stat-value">{(rows||[]).length}</div><div className="stat-foot">Stored as a draft import</div></div><div className="stat-card"><div className="stat-top">Need review</div><div className="stat-value">{outstandingRows.length}</div><div className="stat-foot">No stock update until approval</div></div><div className="stat-card"><div className="stat-top">Import status</div><div style={{marginTop:17}}><span className={statusClass(imp.status)}>{imp.status}</span></div><div className="stat-foot">Repeated file uploads are detected</div></div></div>
  <div className="notice notice-amber" style={{marginBottom:17}}><b>Safety check:</b> product similarity is not product equivalence. Confirm medicine name, strength, formulation, brand and pack size. MRP is only verified when the physical package is checked. Allocation quantity cannot exceed either the remaining invoice quantity or the booking's outstanding request.</div>
  <div className="stack">{outstandingRows.map((row:any)=>{
    const scored=activeItems.map((item:any)=>({...item,match:compareInvoiceRow(row,item)})).sort((a:any,b:any)=>b.match.score-a.match.score);
    const candidate=scored.find((item:any)=>item.match.kind==='Exact match')||scored.find((item:any)=>item.match.kind==='Possible match');
    const label=candidate?candidate.match.kind:'No safe match';
    const suggestions=scored.filter((item:any)=>item.match.kind!=='No safe match').slice(0,50);
    const orderedCandidates=candidate?[candidate,...suggestions.filter((x:any)=>x.id!==candidate.id)]:suggestions;
    return <InvoiceRowReview key={row.id} row={row} importId={id} candidates={orderedCandidates} suggestionItemId={candidate?.id} matchKind={label} matchedBookingLabel={candidate?`${candidate.bookings?.booking_code} / ${candidate.bookings?.customer_name||candidate.bookings?.customer_phone}`:undefined}/>;
  })}</div>
  {!outstandingRows.length&&<div className="card empty-state"><div className="empty-icon">✓</div><div className="empty-title">All rows are allocated or ignored</div><div className="empty-copy">The import does not have any rows waiting for review.</div><Link href="/imports" className="btn btn-primary">Back to imports</Link></div>}
  <section className="card" style={{marginTop:20}}><div className="card-header"><div><div className="card-title">Rows marked allocated or ignored</div><div className="card-description">Historical invoice rows remain available for review.</div></div></div>{(rows||[]).filter((r:any)=>['Ignored','Allocated'].includes(r.review_status)).length?<div className="table-wrap"><table><thead><tr><th>Row</th><th>Product</th><th>Quantity</th><th>Allocated</th><th>Review status</th></tr></thead><tbody>{(rows||[]).filter((r:any)=>['Ignored','Allocated'].includes(r.review_status)).map((r:any)=><tr key={r.id}><td>{r.row_number}</td><td>{r.source_name}</td><td>{Number(r.quantity)+Number(r.free_quantity||0)}</td><td>{r.allocated_quantity}</td><td><span className={statusClass(r.review_status)}>{r.review_status}</span></td></tr>)}</tbody></table></div>:<div style={{padding:18}} className="muted small">No completed row decisions yet.</div>}</section>
 </>;
}
