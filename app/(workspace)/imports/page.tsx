import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import CsvUploadForm from '@/components/csv-upload-form';
import { dateLabel, statusClass } from '@/lib/format';
export default async function ImportsPage(){
 const supabase=await createClient();const {data:imports}=await supabase.from('purchase_imports').select('*').order('created_at',{ascending:false}).limit(40);
 return <div className="csv-import-page"><div className="page-heading"><div><div className="kicker">SUPPLIER RECONCILIATION</div><h1>Purchase CSV import</h1><p>Upload a supplier invoice, map its columns and match rows to booked medicines. Stock changes only after you explicitly approve each allocation.</p></div></div>
  <div className="csv-import-layout"><div><CsvUploadForm/></div><div className="stack"><section className="card"><div className="card-header"><div><div className="card-title">Import history</div><div className="card-description">Recent invoices and reconciliation progress.</div></div></div>{(imports||[]).length?<div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Status</th></tr></thead><tbody>{(imports||[]).map((imp:any)=><tr key={imp.id}><td><Link href={`/imports/${imp.id}`}><div className="table-primary">{imp.invoice_number||imp.file_name}</div><div className="table-secondary">{imp.supplier_name||'Supplier not set'} · {dateLabel(imp.invoice_date||imp.created_at)}</div><div className="table-secondary">{imp.row_count} rows</div></Link></td><td><span className={statusClass(imp.status)}>{imp.status}</span><div style={{marginTop:7}}><Link href={`/imports/${imp.id}`} className="btn btn-secondary btn-small">Review →</Link></div></td></tr>)}</tbody></table></div>:<div className="empty-state"><div className="empty-icon">⇧</div><div className="empty-title">No invoices imported yet</div><div className="empty-copy">Your import history will appear here.</div></div>}</section>
   <div className="notice notice-amber"><b>Important:</b> invoice upload does not update stock. Exact product identity matters — different strength, formulation, release type, brand or pack size must be reviewed separately. Fuzzy matches are suggestions only.</div>
   <a className="btn btn-secondary" href="/samples/purchase-invoice-sample.csv" download>↓ Download sample CSV</a>
  </div></div>
 </div>;
}
