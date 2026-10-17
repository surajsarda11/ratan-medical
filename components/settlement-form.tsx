'use client';
import { useMemo, useState } from 'react';
import { useActionState } from 'react';
import { createSettlementAction, type ActionState } from '@/lib/actions';
import { inr } from '@/lib/format';
import { calculateSettlement } from '@/lib/finance';

export default function SettlementForm({ bookingId, items, availableAdvance }: { bookingId:string; items:any[]; availableAdvance:number }) {
  const [state,action,pending] = useActionState(createSettlementAction, {} as ActionState);
  const [quantities,setQuantities] = useState<Record<string,string>>(()=>Object.fromEntries(items.map((item)=>[item.id,'0'])));
  const [advanceApplied,setAdvanceApplied] = useState('0');
  const [additionalPayment,setAdditionalPayment] = useState('0');
  const [discount,setDiscount] = useState('0');
  const [note,setNote] = useState('');
  const lineItems = useMemo(()=>items.map((item)=>({item_id:item.id,quantity:Number(quantities[item.id]||0)})).filter((item)=>item.quantity>0),[items,quantities]);
  const grossCents = useMemo(()=>items.reduce((total,item)=>total+Math.round(Number(quantities[item.id]||0)*Number(item.verified_mrp||0)*100),0),[items,quantities]);
  const gross = grossCents/100;
  const net = Math.max(0, gross - Math.max(0,Number(discount)||0));
  const preview = useMemo(()=>{try{return calculateSettlement({lines:items.map((item)=>({quantity:quantities[item.id]||0,mrp:item.verified_mrp||0})),discount,advanceApplied,additionalPayment,availableAdvance});}catch{return null;}},[items,quantities,discount,advanceApplied,additionalPayment,availableAdvance]);
  const expectedBalance = preview ? (preview.balanceDueCents-preview.refundDueCents)/100 : net - Math.max(0,Number(advanceApplied)||0) - Math.max(0,Number(additionalPayment)||0);
  const itemsJson = JSON.stringify(lineItems);
  const mprMissing = items.some((item)=>Number(quantities[item.id]||0)>0&&(!item.mrp_verified||!item.verified_mrp));
  return <form action={action} className="card" onSubmit={(event)=>{if(mprMissing){event.preventDefault();window.alert('Please save a verified MRP for every item being collected before settlement.');return;} if(!window.confirm('Confirm the pickup quantities and payment allocations? The settlement will be saved to the ledger.')) event.preventDefault();}}>
    <input type="hidden" name="booking_id" value={bookingId}/><input type="hidden" name="items_json" value={itemsJson}/><input type="hidden" name="customer_note" value={note}/>
    <div className="form-section"><div className="section-head"><div className="section-number">01</div><div><div className="section-head-title">Confirm medicine pickup</div><div className="section-head-sub">Only quantities physically received and not already collected can be settled.</div></div></div>
      <div className="table-wrap"><table><thead><tr><th>Medicine</th><th>Available</th><th>Verified MRP</th><th>Pickup qty</th><th>Line total</th></tr></thead><tbody>{items.map((item:any)=>{
        const available = Math.max(0,Number(item.received_quantity||0)-Number(item.collected_quantity||0));
        const priceOkay = Boolean(item.mrp_verified&&Number(item.verified_mrp)>0);
        const qty = Number(quantities[item.id]||0);
        return <tr key={item.id}><td><div className="table-primary">{item.product_name}</div><div className="table-secondary">{[item.strength,item.dosage_form,item.pack_size].filter(Boolean).join(' · ')}</div><div className="table-secondary">{item.brand||''}</div></td><td>{available} {item.unit_label}</td><td>{priceOkay?<><b>{inr(item.verified_mrp)}</b><div className="table-secondary">Per {item.unit_label?.replace(/s$/,'')||'pack'}</div></>:<span className="status status-red">Not verified</span>}</td><td><input className="input" type="number" min="0" max={available} step="0.001" style={{width:100,padding:'8px'}} value={quantities[item.id]} onChange={(e)=>setQuantities((prev)=>({...prev,[item.id]:e.target.value}))} aria-label={`Pickup quantity for ${item.product_name}`}/></td><td>{priceOkay?inr(Math.round(qty*Number(item.verified_mrp)*100)/100):'—'}</td></tr>;
      })}</tbody></table></div>
      {mprMissing&&<div className="notice notice-amber" style={{marginTop:14}}>At least one selected medicine does not have a verified MRP. Go back to the booking detail and verify the price from the pack before continuing.</div>}
    </div>
    <div className="form-section"><div className="section-head"><div className="section-number">02</div><div><div className="section-head-title">Settlement calculation</div><div className="section-head-sub">Amounts are recalculated on the server from stored verified MRP and payment records.</div></div></div>
      <div className="grid-2"><div className="stack" style={{gap:13}}><div className="field"><label htmlFor="discount">Authorized discount (₹)</label><input className="input" id="discount" name="discount" type="number" min="0" max={gross} step="0.01" value={discount} onChange={(e)=>setDiscount(e.target.value)} /></div><div className="field"><label htmlFor="advance_applied">Advance to apply (₹)</label><input className="input" id="advance_applied" name="advance_applied" type="number" min="0" max={availableAdvance} step="0.01" value={advanceApplied} onChange={(e)=>setAdvanceApplied(e.target.value)} /><small>Unused advance available: {inr(availableAdvance)}. Received advance and applied advance are recorded separately.</small></div><div className="field"><label htmlFor="additional_payment">Additional payment received now (₹)</label><input className="input" id="additional_payment" name="additional_payment" type="number" min="0" max="10000000" step="0.01" value={additionalPayment} onChange={(e)=>setAdditionalPayment(e.target.value)} /></div><div className="field"><label htmlFor="customer_note_visible">Optional customer note</label><textarea className="textarea" id="customer_note_visible" value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Pickup details, thank-you note, etc." maxLength={500}/></div></div>
        <div className="card card-pad" style={{background:'#f9fcf9',boxShadow:'none',alignSelf:'start'}}><div className="card-title">Live estimate</div><div className="money-row" style={{marginTop:12}}><span className="muted">Gross total</span><b>{inr(gross)}</b></div><div className="money-row"><span className="muted">Discount</span><b>− {inr((preview?.discountCents??Math.round(Math.max(0,Number(discount)||0)*100))/100)}</b></div><div className="money-row money-total"><span>Net sale value</span><b>{inr((preview?.netCents??Math.round(net*100))/100)}</b></div><div className="divider"/><div className="money-row"><span className="muted">Advance applied</span><b>− {inr(advanceApplied)}</b></div><div className="money-row"><span className="muted">Additional payment</span><b>− {inr(additionalPayment)}</b></div><div className="divider"/>{!preview&&<div className="notice notice-amber" style={{marginTop:12}}>Review amounts: the discount must not exceed the sale value and applied advance cannot exceed unused advance.</div>}{expectedBalance>0?<><div className="card-title">Balance payable</div><div className="stat-value" style={{fontSize:27}}>{inr(expectedBalance)}</div><div className="card-description">Customer can pay the remaining amount later.</div></>:expectedBalance<0?<><div className="card-title">Potential refund due</div><div className="stat-value" style={{fontSize:27,color:'#9d3a2f'}}>{inr(Math.abs(expectedBalance))}</div><div className="card-description">This records a refund due; record the actual refund separately when paid.</div></>:<><div className="card-title">Balance settled</div><div className="stat-value" style={{fontSize:27}}>{inr(0)}</div></>}</div></div>
    </div>
    {state.error&&<div style={{padding:'0 21px 17px'}}><div className="error-text">{state.error}</div></div>}
    <div className="sticky-actions"><a className="btn btn-secondary" href={`/bookings/${bookingId}`}>Back to booking</a><button type="submit" className="btn btn-primary" disabled={pending||mprMissing}>{pending?'Saving settlement…':'Save settlement and create message →'}</button></div>
  </form>;
}
