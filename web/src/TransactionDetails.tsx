import { useEffect, useRef, useState } from 'react';
import { CreditReview } from './CreditReview';

type Section = 'sales' | 'purchasing' | 'receivables' | 'payables';
type Values = Record<string, string | number | null | undefined>;
type Related = {doctype: string; access: 'available' | 'restricted'; has_more: boolean; records: {name: string; status: string; docstatus: number}[]};
type Detail = {doctype: string; section: Section; party_field: string; date_field: string; document: Values; items: Values[]; related: Related[]};
const routes: Record<string, {route: string; section?: Section; label: string}> = {
  'Sales Order': {route:'sales-order',section:'sales',label:'Sales orders'},
  'Purchase Order': {route:'purchase-order',section:'purchasing',label:'Purchase orders'},
  'Sales Invoice': {route:'sales-invoice',section:'receivables',label:'Customer invoices'},
  'Purchase Invoice': {route:'purchase-invoice',section:'payables',label:'Supplier bills'},
  'Delivery Note': {route:'delivery-note',label:'Deliveries'},
  'Purchase Receipt': {route:'purchase-receipt',label:'Receipts'},
  'Payment Entry': {route:'payment-entry',label:'Payment entries'},
};
function text(value: unknown) {return value === undefined || value === null ? 'Not available' : String(value);}
function money(value: unknown, code: unknown) {
  if (typeof value !== 'number' || typeof code !== 'string' || !/^[A-Z]{3}$/.test(code)) return 'Not available';
  return new Intl.NumberFormat('en-PH',{style:'currency',currency:code}).format(value);
}
export function TransactionDetails({section,name,company,onBack,onNavigate}: {
  section: Section; name: string; company: string; onBack: () => void;
  onNavigate: (section: Section, name: string) => void;
}) {
  const [data,setData] = useState<Detail|null>(null);
  const [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(()=>controller.abort(),15000);
    setData(null);setError('');
    const params = new URLSearchParams({section,name,company});
    fetch('/api/method/quarter_erp.api.transaction?'+params,{credentials:'same-origin',cache:'no-store',signal:controller.signal})
      .then(async response => {
        if(!response.ok) throw new Error(response.status===401||response.status===403 ? 'This record is unavailable in your current company and permissions.' : 'The transaction could not load. Please retry.');
        return response.json();
      }).then(result => {if(active)setData(result.message);})
      .catch(reason => {if(active)setError(reason.name==='AbortError'?'The request timed out. Please retry.':reason.message);})
      .finally(()=>clearTimeout(timeout));
    return ()=>{active=false;clearTimeout(timeout);controller.abort();};
  },[section,name,company,revision]);
  useEffect(()=>{if(data)heading.current?.focus();},[data]);
  const doc = data?.document;
  const currency = doc?.currency;
  return <section className="transaction" aria-label="Transaction details">
    <div className="transaction-toolbar"><button className="back-link" onClick={onBack}>← Back to list</button><div className="transaction-actions"><button className="refresh" disabled={!data} onClick={()=>setRevision(n=>n+1)}>↻ Refresh transaction</button>{data && <a className="text-link" href={'/desk/'+routes[data.doctype].route+'/'+encodeURIComponent(name)}>Edit & actions in full ERP ↗</a>}</div></div>
    {error ? <div className="empty" role="alert"><h2>We couldn’t open this transaction.</h2><p>{error}</p><button onClick={()=>setRevision(n=>n+1)}>Retry transaction</button></div> : !data || !doc ? <div className="loading" role="status"><div className="loading-line"/><div className="loading-line"/><p>Loading permitted transaction details…</p></div> : <>
      <header className="transaction-heading"><div><div className="eyebrow">{data.doctype}</div><h1 tabIndex={-1} ref={heading}>{text(doc.name)}</h1><p>{text(doc[data.party_field])}</p></div><div><span className={'status '+(doc.status==='Paid'?'complete':'')}>{text(doc.status)}</span><div className="transaction-total">{money(doc.grand_total,currency)}</div><small>{text(currency)} · {text(doc.company)}</small></div></header>
      <div className="transaction-facts"><div><span>Document date</span><strong>{text(doc.transaction_date ?? doc.posting_date)}</strong></div><div><span>{section==='sales'?'Expected delivery':section==='purchasing'?'Expected receipt':'Due date'}</span><strong>{text(doc[data.date_field])}</strong></div><div><span>Document state</span><strong>{doc.docstatus===1?'Submitted':doc.docstatus===2?'Cancelled':doc.docstatus===0?'Draft':'Not available'}</strong></div>{doc.outstanding_amount!==undefined && <div><span>Remaining balance</span><strong>{money(doc.outstanding_amount,currency)}</strong></div>}</div>
      {section==='sales' && <CreditReview key={company+name+revision} name={name} company={company} onInvoice={invoice=>onNavigate('receivables',invoice)}/> }
      <div className="detail-grid"><div className="detail-content"><section aria-label="Line items"><div className="detail-section-title"><span className="section-number">01</span><h3>Line items</h3><span>{data.items.length} visible</span></div><div className="detail-table-scroll"><table><thead><tr><th scope="col">Item</th><th scope="col" className="number">Quantity</th><th scope="col" className="number">Rate</th><th scope="col" className="number">Amount</th>{section==='sales'||section==='purchasing'?<th scope="col" className="number">{section==='sales'?'Delivered':'Received'}</th>:null}</tr></thead><tbody>{data.items.map((item,index)=><tr key={String(item.name??index)}><td><strong>{text(item.item_name??item.item_code)}</strong><small>{text(item.item_code)}</small><small>Warehouse: {text(item.warehouse)}</small></td><td className="number">{text(item.qty)}<small>{text(item.uom)}</small></td><td className="number">{money(item.rate,currency)}</td><td className="number">{money(item.amount,currency)}</td>{section==='sales'||section==='purchasing'?<td className="number">{text(section==='sales'?item.delivered_qty:item.received_qty)}<small>{text(item.uom)}</small></td>:null}</tr>)}</tbody></table>{!data.items.length && <p className="detail-note">No visible line items.</p>}</div></section>
      <section className="totals" aria-label="Transaction totals"><dl><div><dt>Net total</dt><dd>{money(doc.net_total,currency)}</dd></div><div><dt>Taxes & charges</dt><dd>{money(doc.total_taxes_and_charges,currency)}</dd></div><div className="total-row"><dt>Grand total</dt><dd>{money(doc.grand_total,currency)}</dd></div>{doc.disable_rounded_total===0 && <><div><dt>Rounding adjustment</dt><dd>{money(doc.rounding_adjustment,currency)}</dd></div><div><dt>Rounded total</dt><dd>{money(doc.rounded_total,currency)}</dd></div></>}</dl><p>Totals come directly from the posted or saved ERP document.</p></section></div>
      <aside className="record-trail" aria-label="Related records"><div className="detail-section-title"><span className="section-number">02</span><h3>Related records</h3></div><p className="detail-note">Actual document links, including partial transactions. Open an invoice to follow its payments.</p>{data.related.map(group=><section className="trail-group" key={group.doctype}><h4>{routes[group.doctype].label}</h4>{group.access==='restricted'?<p>Not available with your current permissions.</p>:!group.records.length?<p>No visible linked records.</p>:group.records.map(link=>{
        const target=routes[group.doctype];
        const contents=<><strong>{link.name}</strong><span>{link.status}{link.docstatus===2?' · Cancelled':''}</span><span className="trail-arrow" aria-hidden="true">{target.section?'→':'↗'}</span></>;
        return target.section?<button className="trail-record" key={link.name} onClick={()=>onNavigate(target.section!,link.name)}>{contents}</button>:<a className="trail-record" key={link.name} href={'/desk/'+target.route+'/'+encodeURIComponent(link.name)} aria-label={link.name+' · Open in full ERP'}>{contents}</a>;
      })}{group.has_more && <p>Showing the first 50 visible links. Use the full ERP record for more.</p>}</section>)}<p className="detail-note">↗ opens a native ERP record under the same session.</p></aside></div>
    </>}
  </section>;
}
