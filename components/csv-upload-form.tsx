'use client';
import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import { useActionState } from 'react';
import { createImportDraftAction, type ActionState } from '@/lib/actions';
import FeedbackToast from '@/components/feedback-toast';

type FieldKey = 'sku'|'source_name'|'generic_name'|'strength'|'dosage_form'|'brand'|'pack_size'|'batch_number'|'expiry_date'|'quantity'|'free_quantity'|'purchase_rate'|'mrp';
type RawRow = Record<string,string>;
const fieldInfo: {key:FieldKey;label:string;required?:boolean}[] = [
  {key:'source_name',label:'Product / medicine name',required:true},{key:'sku',label:'SKU / barcode / product code'},
  {key:'generic_name',label:'Generic / ingredient'},{key:'strength',label:'Strength'},{key:'dosage_form',label:'Formulation / dosage form'},
  {key:'brand',label:'Brand / manufacturer'},{key:'pack_size',label:'Pack size'},{key:'batch_number',label:'Batch / lot number'},
  {key:'expiry_date',label:'Expiry date'},{key:'quantity',label:'Purchased quantity',required:true},{key:'free_quantity',label:'Free quantity'},
  {key:'purchase_rate',label:'Purchase rate'},{key:'mrp',label:'MRP per pack'},
];
const aliases: Record<FieldKey,string[]> = {
  sku:['sku','barcode','product code','item code','hsn item code','code'], source_name:['product name','medicine name','name','product','item name','item description','description','stock item','medicine','product description'],
  generic_name:['generic name','generic','ingredient','active ingredient','molecule'], strength:['strength','dose','composition strength'],dosage_form:['dosage form','formulation','form','type'],
  brand:['brand','manufacturer','company','brand name','mfg name'],pack_size:['pack size','packing','pack','package size','unit size'],batch_number:['batch','batch number','batch no','lot','lot number'],
  expiry_date:['expiry','expiry date','exp date','exp. date','exp'],quantity:['qty','quantity','purchase quantity','invoice quantity','purchased qty','net qty','received qty'],
  free_quantity:['free qty','free quantity','scheme qty','bonus quantity'],purchase_rate:['purchase rate','rate','ptr','cost price','purchase price','unit rate'],mrp:['mrp','mrp per pack','maximum retail price','retail price'],
};
function norm(s:string){return s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')}
function autoMapping(headers:string[]) {
  const result = {} as Record<FieldKey,string>;
  for(const field of fieldInfo){ const match=headers.find((header)=>aliases[field.key].some((alias)=>norm(header)===norm(alias))); if(match)result[field.key]=match; }
  return result;
}
function dateForDatabase(value: string) {
  const v=(value||'').trim(); if(!v)return '';
  const make=(year:number,month:number,day:number)=>{
    const date=new Date(Date.UTC(year,month-1,day));
    return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day
      ? `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}` : '';
  };
  let m=v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(m)return make(Number(m[1]),Number(m[2]),Number(m[3]));
  m=v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if(m){const year=Number(m[3].length===2?`20${m[3]}`:m[3]);return make(year,Number(m[2]),Number(m[1]));}
  m=v.match(/^(\d{1,2})[- /]([A-Za-z]{3,9})[- /](\d{2,4})$/);
  if(m){const month=new Date(`${m[2].slice(0,3)} 1, 2000`).getMonth()+1;const year=Number(m[3].length===2?`20${m[3]}`:m[3]);return make(year,month,Number(m[1]));}
  // Ambiguous supplier expiry text is left blank rather than sending an invalid SQL date.
  return '';
}
export default function CsvUploadForm(){
  const [state,action,pending]=useActionState(createImportDraftAction,{} as ActionState);
  const [fileName,setFileName]=useState(''); const [headers,setHeaders]=useState<string[]>([]); const [rawRows,setRawRows]=useState<RawRow[]>([]); const [mapping,setMapping]=useState<Record<FieldKey,string>>({} as Record<FieldKey,string>); const [parseError,setParseError]=useState('');
  const [supplier,setSupplier]=useState(''); const [invoiceNumber,setInvoiceNumber]=useState(''); const [invoiceDate,setInvoiceDate]=useState('');
  const mappedRows=useMemo(()=>rawRows.map((row)=>{
    const get=(key:FieldKey)=>String(mapping[key]?row[mapping[key]]??'':'').trim();
    const numeric=(key:FieldKey)=>{const raw=get(key).replace(/[₹,\s]/g,'');return raw===''?'':Number(raw);};
    return {sku:get('sku'),source_name:get('source_name'),generic_name:get('generic_name'),strength:get('strength'),dosage_form:get('dosage_form'),brand:get('brand'),pack_size:get('pack_size'),batch_number:get('batch_number'),expiry_date:dateForDatabase(get('expiry_date')),quantity:numeric('quantity'),free_quantity:numeric('free_quantity')||0,purchase_rate:numeric('purchase_rate'),mrp:numeric('mrp')};
  }),[rawRows,mapping]);
  const handleFile=(file?:File)=>{
    setParseError('');setRawRows([]);setHeaders([]);setMapping({} as Record<FieldKey,string>);setFileName('');
    if(!file)return;
    if(!file.name.toLowerCase().endsWith('.csv')){setParseError('Please select a .csv file.');return;}
    if(file.size>2.5*1024*1024){setParseError('File is larger than 2.5 MB. Split it into smaller CSV files and retry.');return;}
    setFileName(file.name);
    Papa.parse<RawRow>(file,{header:true,skipEmptyLines:'greedy',transformHeader:(h)=>h.trim(),complete:(result)=>{
      const errs=result.errors.filter((e)=>e.code!=='TooFewFields');
      if(errs.length){setParseError(`Could not parse all CSV rows: ${errs[0].message}. Check the source file's quoting and delimiters.`);return;}
      const cleanHeaders=(result.meta.fields||[]).filter((h)=>h.trim()); const cleanRows=result.data.filter((row)=>Object.values(row).some((v)=>String(v||'').trim()));
      if(!cleanHeaders.length||!cleanRows.length){setParseError('No header row or data rows were found.');return;}
      if(cleanRows.length>5000){setParseError('This file has more than 5,000 data rows. Split it into smaller files.');return;}
      const guessed=autoMapping(cleanHeaders);setHeaders(cleanHeaders);setRawRows(cleanRows);setMapping(guessed);
      if(!guessed.source_name||!guessed.quantity)setParseError('The file parsed, but product name and quantity columns need to be mapped before importing.');
    }});
  };
  const hasMapping=Boolean(mapping.source_name&&mapping.quantity);
  const mappingOptions=(field:FieldKey)=> <select className="select" value={mapping[field]||''} onChange={(e)=>setMapping((prev)=>({...prev,[field]:e.target.value}))}><option value="">— Not mapped —</option>{headers.map((h)=><option key={h} value={h}>{h}</option>)}</select>;
  return <form action={action} onSubmit={(e)=>{if(!rawRows.length||!hasMapping){e.preventDefault();setParseError('Upload a valid CSV and map product name plus purchased quantity.');return;} if(!window.confirm(`Create a draft import with ${mappedRows.length} rows? No stock or booking will change until you approve allocations row by row.`))e.preventDefault();}} className="card csv-import-form">
    <input type="hidden" name="file_name" value={fileName}/><input type="hidden" name="rows_json" value={JSON.stringify(mappedRows)}/>
    <div className="form-section"><div className="section-head"><div className="section-number">01</div><div><div className="section-head-title">Choose supplier invoice CSV</div><div className="section-head-sub">CSV only · maximum 2.5 MB / 5,000 rows. File upload creates a draft; no stock is changed yet.</div></div></div>
      <div className="field"><label htmlFor="csv-file">Purchase invoice file *</label><input id="csv-file" className="input" type="file" accept=".csv,text/csv" onChange={(e)=>handleFile(e.target.files?.[0])}/><small>Common supplier column names are detected automatically, but always review the mapping before importing.</small></div>
      {parseError&&<div className="notice notice-amber" style={{marginTop:13}}>{parseError}</div>}
      {rawRows.length>0&&<div className="notice" style={{marginTop:13}}>Loaded <b>{rawRows.length}</b> data rows from <b>{fileName}</b>. Map columns below, then inspect the preview.</div>}
    </div>
    <div className="form-section"><div className="section-head"><div className="section-number">02</div><div><div className="section-head-title">Invoice details</div><div className="section-head-sub">Use the same supplier and invoice number when reviewing an invoice later.</div></div></div>
      <div className="form-grid-3"><div className="field"><label>Supplier name</label><input className="input" name="supplier_name" value={supplier} onChange={(e)=>setSupplier(e.target.value)} placeholder="Supplier / distributor" maxLength={180}/></div><div className="field"><label>Invoice number</label><input className="input" name="invoice_number" value={invoiceNumber} onChange={(e)=>setInvoiceNumber(e.target.value)} placeholder="e.g. INV-1024" maxLength={120}/></div><div className="field"><label>Invoice date</label><input className="input" name="invoice_date" type="date" value={invoiceDate} onChange={(e)=>setInvoiceDate(e.target.value)}/></div></div>
    </div>
    <div className="form-section"><div className="section-head"><div className="section-number">03</div><div><div className="section-head-title">Map the CSV columns</div><div className="section-head-sub">Supplier files differ. Confirm at least product name and quantity. Never interpret purchase rate as MRP.</div></div></div>
      {headers.length? <div className="form-grid-3">{fieldInfo.map((field)=><div className="field" key={field.key}><label>{field.label}{field.required?' *':''}</label>{mappingOptions(field.key)}{field.key==='mrp'&&<small>Only a suggested price; verify the actual MRP printed on the pack before settlement.</small>}</div>)}</div>:<div className="empty-state" style={{padding:20}}><div className="empty-icon">⇧</div><div className="empty-title">Column mapping will appear here</div><div className="empty-copy">Choose a CSV file above to inspect its headers and choose the matching fields.</div></div>}
    </div>
    <div className="form-section"><div className="section-head"><div className="section-number">04</div><div><div className="section-head-title">Preview before import</div><div className="section-head-sub">Only the first 8 rows are displayed here; all valid rows go into the draft.</div></div></div>
      {mappedRows.length? <div className="table-wrap"><table><thead><tr><th>Source name</th><th>Strength / form</th><th>Pack size</th><th>Quantity</th><th>Purchase rate</th><th>MRP (suggested)</th></tr></thead><tbody>{mappedRows.slice(0,8).map((r:any,index)=><tr key={index}><td><div className="table-primary">{r.source_name||<span className="status status-red">Missing</span>}</div><div className="table-secondary">{r.sku||'No product code'}</div></td><td>{[r.strength,r.dosage_form].filter(Boolean).join(' · ')||'—'}</td><td>{r.pack_size||'—'}</td><td>{r.quantity===''?'—':r.quantity}</td><td>{r.purchase_rate===''?'—':`₹${r.purchase_rate}`}</td><td>{r.mrp===''?'—':`₹${r.mrp}`}</td></tr>)}</tbody></table></div>:<div className="notice notice-neutral">Select a CSV file and map columns to see a preview.</div>}
    </div>
    {state.error&&<div style={{padding:'0 21px 17px'}}><div className="error-text">{state.error}</div></div>}
    <div className="sticky-actions"><button type="submit" className="btn btn-primary" disabled={pending||!rawRows.length||!hasMapping}>{pending?'Creating draft…':'Create draft for matching →'}</button></div>
  </form>;
}
