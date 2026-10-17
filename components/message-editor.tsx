'use client';
import { useActionState, useState } from 'react';
import { markWhatsAppSentAction, saveMessageDraftAction, type ActionState } from '@/lib/actions';
import WhatsAppDraftButton from '@/components/whatsapp-draft-button';

export default function MessageEditor({ settlementId, bookingId, phone, initialMessage }: { settlementId:string; bookingId:string; phone:string; initialMessage:string }) {
  const [state,action,pending] = useActionState(saveMessageDraftAction, {} as ActionState);
  const [message,setMessage] = useState(initialMessage);
  return <div className="card"><div className="card-header"><div><div className="card-title">Editable WhatsApp message</div><div className="card-description">Edit the draft if needed, save it, then open WhatsApp to review and send manually.</div></div></div>
    <form action={action}><input type="hidden" name="settlement_id" value={settlementId}/><div className="form-section"><textarea className="textarea message-preview" name="message_text" value={message} onChange={(e)=>setMessage(e.target.value)} rows={23} maxLength={12000} required/><div className="muted tiny" style={{marginTop:9}}>Editing this text does not alter the saved financial figures. Double-check the amounts before sending.</div></div><div style={{padding:'0 20px 18px',display:'flex',gap:9,flexWrap:'wrap',alignItems:'center'}}><button className="btn btn-secondary" type="submit" disabled={pending}>{pending?'Saving draft…':'Save edited message'}</button><WhatsAppDraftButton bookingId={bookingId} phone={phone} message={message} kind="settlement" label="Open current text in WhatsApp"/><form action={markWhatsAppSentAction}><input type="hidden" name="booking_id" value={bookingId}/><input type="hidden" name="kind" value="settlement"/><button className="btn btn-secondary" type="submit">Mark sent (manual confirmation)</button></form></div>{state.error&&<div style={{padding:'0 20px 18px'}} className="error-text">{state.error}</div>}{state.success&&<div style={{padding:'0 20px 18px'}} className="success-text">{state.success}</div>}</form>
  </div>;
}
