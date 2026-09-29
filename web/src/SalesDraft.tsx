import { useEffect, useId, useRef, useState } from 'react';

type Line = {item_code: string; qty: string; rate: string; warehouse: string};
type Payload = {company: string; customer: string; delivery_date: string; items: Line[]};
type Pending = {command_key: string; payload: Payload};
const endpoint = '/api/method/quarter_erp.commands.';
const storageKey = (user: string, company: string) => 'orbit.pending-sales:v1:'+JSON.stringify([user,company]);
export function hasPendingSales(user: string, company: string) {
  try {return sessionStorage.getItem(storageKey(user,company)) !== null;} catch {return false;}
}
function readPending(user: string, company: string): Pending|null {
  const raw = sessionStorage.getItem(storageKey(user,company));
  if (!raw) return null;
  const data = JSON.parse(raw);
  if (!data.command_key || data.payload?.company !== company || !Array.isArray(data.payload?.items)) throw new Error('The saved recovery data could not be read. Keep this tab open and use the full ERP to check your orders.');
  return data;
}
async function request(path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),20000);
  try {
    const response=await fetch(endpoint+path,{...init,credentials:'same-origin',cache:'no-store',signal:controller.signal});
    const data=await response.json();
    return {ok:response.ok,status:response.status,data};
  }
  finally {clearTimeout(timer);}
}
function serverMessage(data: {_server_messages?: string}) {
  try {
    const messages: string[] = JSON.parse(data._server_messages || '[]');
    const text = messages.map(value=>JSON.parse(value).message).join(' ');
    return new DOMParser().parseFromString(text,'text/html').body.textContent?.slice(0,1500) || 'The ERP rejected this draft. Review the selected records and values.';
  } catch {return 'The ERP rejected this draft. Review the selected records and values.';}
}

function RecordChoice({kind,label,company,value,onChange,required=true}: {
  kind: 'customer'|'item'|'warehouse'; label: string; company: string; value: string;
  onChange: (value: string)=>void; required?: boolean;
}) {
  const id=useId();
  const [names,setNames]=useState<string[]>([]);
  const [note,setNote]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    let active=true;
    setNames([]);setNote('Searching…');
    const timer=setTimeout(async()=>{
      const timeout=setTimeout(()=>controller.abort(),15000);
      try {
        const response=await fetch(endpoint+'sales_draft_links?'+new URLSearchParams({company,kind,search:value}),{credentials:'same-origin',cache:'no-store',signal:controller.signal});
        if(!response.ok)throw new Error();
        const data=(await response.json()).message;
        if(active){setNames(data.names);setNote(data.has_more?'First 20 matches. Type to narrow the choices.':data.names.length?'Select a matching record.':'No matching records.');}
      } catch {if(active)setNote('Choices unavailable. Check the record name or try typing again.');}
      finally {clearTimeout(timeout);}
    },200);
    return()=>{active=false;clearTimeout(timer);controller.abort();};
  },[company,kind,value]);
  return <label className="draft-field">{label}<input aria-label={label} required={required} value={value} list={id} onChange={e=>onChange(e.target.value)} autoComplete="off" aria-describedby={id+'-note'}/><datalist id={id}>{names.map(name=><option key={name} value={name}/>)}</datalist><small id={id+'-note'}>{note}</small></label>;
}

export function SalesDraft({company,user,currency,onSaved,onCancel}: {
  company: string; user: string; currency: string; onSaved: (name: string)=>void; onCancel: ()=>void;
}) {
  const initial=useRef<{pending: Pending|null; error: string}|null>(null);
  if(!initial.current) {
    try {initial.current={pending:readPending(user,company),error:''};}
    catch(reason) {initial.current={pending:null,error:(reason as Error).message};}
  }
  const recovered=initial.current.pending;
  const [customer,setCustomer]=useState(recovered?.payload.customer || '');
  const [delivery,setDelivery]=useState(recovered?.payload.delivery_date || '');
  const [lines,setLines]=useState<(Line & {id:string})[]>(recovered?.payload.items.map(row=>({...row,id:crypto.randomUUID()})) || [{id:crypto.randomUUID(),item_code:'',qty:'1',rate:'0',warehouse:''}]);
  const [phase,setPhase]=useState<'ready'|'saving'|'uncertain'>(recovered?'uncertain':'ready');
  const [error,setError]=useState(initial.current.error);
  const pending=useRef<Pending|null>(recovered);
  const heading=useRef<HTMLHeadingElement>(null);
  const submitting=useRef(false);
  const locked=phase!=='ready' || !!initial.current.error;
  useEffect(()=>{heading.current?.focus();},[]);
  useEffect(()=>{
    const warn=(event: BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',warn);
    return()=>window.removeEventListener('beforeunload',warn);
  },[]);
  const updateLine=(id:string,patch:Partial<Line>)=>setLines(rows=>rows.map(row=>row.id===id?{...row,...patch}:row));
  async function save() {
    if(submitting.current)return;
    submitting.current=true;setPhase('saving');setError('');
    let sent=false;
    const recovering=!!pending.current;
    try {
      const context=await request('session_context');
      if(!context.ok)throw new Error('Your session is unavailable. Sign in to the full ERP in another tab, then retry here.');
      const token=context.data.message.csrf_token;
      const command=pending.current || {command_key:crypto.randomUUID(),payload:{company,customer,delivery_date:delivery,items:lines.map(({id,...row})=>row)}};
      // Persist before sending so a reload can retry the identical command.
      sessionStorage.setItem(storageKey(user,company),JSON.stringify(command));
      pending.current=command;
      sent=true;
      const response=await request('save_sales_draft',{method:'POST',headers:{'Content-Type':'application/json','X-Frappe-CSRF-Token':token},body:JSON.stringify(command)});
      if(!response.ok) {
        if(response.status>=500 || response.status===409)throw new Error('We could not confirm the save. Retry the same save to check its result without creating a second order.');
        const data=response.data;
        // A later permission/validation failure cannot prove an earlier attempt
        // did not commit. Retain its identity until a successful replay.
        if(recovering)throw new Error(serverMessage(data));
        sessionStorage.removeItem(storageKey(user,company));pending.current=null;sent=false;
        throw new Error(serverMessage(data));
      }
      const result=response.data.message;
      if(typeof result?.name!=='string')throw new Error('We could not confirm the saved record. Retry the same save.');
      sessionStorage.removeItem(storageKey(user,company));
      pending.current=null;
      onSaved(result.name);
    } catch(reason) {
      const detail=(reason as Error).name==='AbortError'?'The request timed out.':(reason as Error).message;
      setError(sent?detail+' Your entries are retained. Retry the same save to confirm its result.':detail);
      setPhase(pending.current?'uncertain':'ready');
    } finally {submitting.current=false;}
  }
  return <main className="draft-page">
    <div className="draft-top"><a className="brand draft-brand" href="/orbit" onClick={event=>{event.preventDefault();if(!locked && window.confirm('Discard this unsaved draft?'))onCancel();}}><span className="brand-mark">◒</span><span>orbit</span></a><span>{company} · {currency}</span></div>
    <section className="draft-card" aria-label="New sales order">
      <header><div className="eyebrow">SALES / NEW ORDER</div><h1 ref={heading} tabIndex={-1}>Create a sales order</h1><p>Choose a customer, set the delivery date, and add the items they need.</p></header>
      <form onSubmit={event=>{event.preventDefault();void save();}}>
        {(error || phase==='uncertain') && <div className="draft-error" role="alert"><strong>{phase==='uncertain'?'Confirm the previous save':'Review this draft'}</strong><p>{error || 'An earlier save has an unconfirmed outcome. Retry to recover the saved order. Your entries are locked until its result is known.'}</p></div>}
        <fieldset disabled={locked}>
          <legend>Customer & delivery</legend>
          <div className="draft-header-fields"><RecordChoice kind="customer" label="Customer" company={company} value={customer} onChange={setCustomer}/><label className="draft-field">Expected delivery<input type="date" required value={delivery} onChange={e=>setDelivery(e.target.value)}/><small>Used for new item schedules.</small></label></div>
          <div className="draft-lines-title"><h2>Order items</h2><span>{lines.length} {lines.length===1?'line':'lines'}</span></div>
          <div className="draft-lines">{lines.map((row,index)=><section key={row.id} className="draft-line" aria-label={'Line '+(index+1)}>
            <div className="draft-line-number"><strong>{String(index+1).padStart(2,'0')}</strong><button type="button" aria-label={'Remove line '+(index+1)} disabled={lines.length===1} onClick={()=>setLines(current=>current.filter(line=>line.id!==row.id))}>Remove</button></div>
            <div className="draft-line-fields"><RecordChoice kind="item" label={'Item '+(index+1)} company={company} value={row.item_code} onChange={item_code=>updateLine(row.id,{item_code})}/><RecordChoice kind="warehouse" label={'Warehouse '+(index+1)} company={company} value={row.warehouse} onChange={warehouse=>updateLine(row.id,{warehouse})}/><label className="draft-field">Quantity {index+1}<input type="number" min="0.000000000001" max="1000000000000" step="any" required value={row.qty} onChange={e=>updateLine(row.id,{qty:e.target.value})}/></label><label className="draft-field">Unit price {index+1} ({currency})<input type="number" min="0" max="1000000000000" step="any" required value={row.rate} onChange={e=>updateLine(row.id,{rate:e.target.value})}/></label></div>
          </section>)}</div>
          <button className="refresh add-line" type="button" disabled={lines.length>=200} onClick={()=>setLines(current=>[...current,{id:crypto.randomUUID(),item_code:'',qty:'1',rate:'0',warehouse:current.at(-1)?.warehouse || ''}])}>＋ Add another item</button>
        </fieldset>
        <div className="draft-save-bar"><div><strong>Save as draft</strong><p>Review the ERP-calculated totals before submitting. Saving does not post accounting or move stock.</p></div><div className="draft-buttons"><button className="refresh" type="button" disabled={locked} onClick={()=>{if(window.confirm('Discard this unsaved draft?'))onCancel();}}>Cancel</button><button className="primary" type="submit" disabled={phase==='saving' || !!initial.current.error}>{phase==='saving'?'Saving…':phase==='uncertain'?'Retry same save':'Save draft →'}</button></div></div>
      </form>
      <p className="draft-native-note">Need pricing rules, taxes, addresses or advanced fields? <a href="/desk/sales-order/new" target="_blank" rel="noreferrer">Open the full sales-order form ↗</a></p>
    </section>
  </main>;
}
