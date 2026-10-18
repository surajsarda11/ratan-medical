'use client';

import { useActionState, useEffect, useState } from 'react';
import { markWhatsAppSentAction, saveMessageDraftAction, type ActionState } from '@/lib/actions';
import WhatsAppDraftButton from '@/components/whatsapp-draft-button';
import FeedbackToast from '@/components/feedback-toast';
import BillActions from '@/components/bill-actions';

export default function MessageEditor({ settlementId, bookingId, phone, initialMessage, whatsappAllowed }: { settlementId:string; bookingId:string; phone:string; initialMessage:string; whatsappAllowed:boolean }) {
  const [state,action,pending] = useActionState(saveMessageDraftAction, {} as ActionState);
  const [message,setMessage] = useState(initialMessage);
  const [saveToast,setSaveToast] = useState('');

  useEffect(() => {
    if (!state.success) return;
    setSaveToast(state.success);
    const timer = window.setTimeout(() => setSaveToast(''), 6000);
    return () => window.clearTimeout(timer);
  }, [state]);

  return <div className="card">
    <div className="card-header"><div><div className="card-title">Delivery completion and itemized bill message</div><div className="card-description">Review or edit this saved bill message. Copy, download or print it, or open WhatsApp Messenger to send manually.</div></div></div>
    <form action={action}>
      <input type="hidden" name="settlement_id" value={settlementId}/>
      <div className="form-section">
        <textarea className="textarea message-preview" name="message_text" value={message} onChange={(e)=>setMessage(e.target.value)} rows={23} maxLength={12000} required/>
        <div className="muted tiny" style={{marginTop:9}}>Editing this text does not alter the saved financial figures. Double-check the amounts before sending.</div>
      </div>
      <div style={{padding:'0 20px 18px',display:'flex',gap:9,flexWrap:'wrap',alignItems:'center'}}>
        <button className="btn btn-secondary" type="submit" disabled={pending}>{pending?'Saving draft…':'Save edited message'}</button>
      </div>
      {state.error&&<FeedbackToast title="Message draft not saved" message={state.error} tone="error" trigger={state}/>}{state.error&&<div style={{padding:'0 20px 18px'}} className="error-text" role="alert">{state.error}</div>}
    </form>
    <div style={{padding:'0 20px 18px'}}><BillActions message={message} filename={`ratan-medical-hall-${settlementId}-bill.txt`}/></div>
    {whatsappAllowed ? <div style={{padding:'0 20px 18px',display:'flex',gap:9,flexWrap:'wrap',alignItems:'center'}}>
      <WhatsAppDraftButton bookingId={bookingId} phone={phone} message={message} kind="settlement" label="Open draft in WhatsApp Messenger" allowed={whatsappAllowed}/>
      <form action={markWhatsAppSentAction}>
        <input type="hidden" name="booking_id" value={bookingId}/>
        <input type="hidden" name="kind" value="settlement"/>
        <input type="hidden" name="return_path" value={`/settlements/${settlementId}`}/>
        <button className="btn btn-secondary" type="submit">Mark sent (manual confirmation)</button>
      </form>
    </div> : <div style={{padding:'0 20px 18px'}}><div className="notice notice-amber">WhatsApp draft and mark-sent actions are unavailable because customer consent is {whatsappAllowed ? 'not confirmed' : 'not recorded as agreed'}. Update the consent choice in booking details first.</div></div>}
    {saveToast&&<div className="action-toast action-toast-success" role="status" aria-live="polite"><div className="action-toast-icon" aria-hidden="true">✓</div><div className="action-toast-copy"><strong>Message draft saved</strong><span>{saveToast}</span></div><button type="button" className="action-toast-close" onClick={()=>setSaveToast('')} aria-label="Dismiss notification">×</button></div>}
  </div>;
}
