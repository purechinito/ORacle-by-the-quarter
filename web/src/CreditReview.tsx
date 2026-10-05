import { useEffect, useState } from 'react';
import './credit-review.css';

type Invoice = {name:string;posting_date:string;due_date:string|null;original_currency:string;original_total:number;invoice_total:number;outstanding:number;overdue:number;days_overdue:number};
type Review = {company:string;customer_name:string;currency:string;checked_at:string;prepared_by:string;docstatus:number;can_submit:boolean;payment_terms:string|null;
  credit_limit:number|null;ledger_balance:number;unpaid_invoices:number;overdue:number;available_credits:number;other_orders:number;unbilled_deliveries:number;this_order:number;projected_exposure:number;remaining_credit:number|null;over_limit:number|null;
  invoices:Invoice[];credits:{doctype:string;name:string;amount:number}[];orders:{name:string;date:string;unbilled:number}[];warnings:string[]};

export function CreditReview({name,company,onInvoice}:{name:string;company:string;onInvoice:(name:string)=>void}) {
  const [data,setData]=useState<Review|null>(null);
  const [error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  const [visible,setVisible]=useState(20);
  useEffect(()=>{
    const abort=new AbortController();let active=true;
    const timeout=setTimeout(()=>abort.abort(),15000);
    setData(null);setError('');setVisible(20);
    fetch('/api/method/quarter_erp.credit.review?'+new URLSearchParams({name,company}),{credentials:'same-origin',cache:'no-store',signal:abort.signal})
      .then(async response=>{
        if(!response.ok)throw new Error(response.status===401||response.status===403?'The reviewer needs complete customer accounting access for this company. Partial balances are not shown as a complete credit position.':'The complete credit position could not load. Refresh or use the full accounting reports before deciding.');
        return response.json();
      }).then(result=>{if(active)setData(result.message);})
      .catch(reason=>{if(active)setError(reason.name==='AbortError'?'The credit check timed out. Refresh before making an approval decision.':reason.message);})
      .finally(()=>clearTimeout(timeout));
    return()=>{active=false;abort.abort();clearTimeout(timeout);};
  },[name,company,revision]);
  const money=(value:number|null)=>value===null?'Not set':new Intl.NumberFormat('en-PH',{style:'currency',currency:data?.currency||'PHP'}).format(value);
  return <section className="credit-review" aria-label="Customer credit review">
    <header className="credit-heading"><div><div className="eyebrow">BEFORE YOU APPROVE</div><h2>Can this customer take another order?</h2><p>The balance behind your decision.</p></div><button type="button" className="refresh" onClick={()=>setRevision(n=>n+1)}>↻ Refresh credit</button></header>
    {error?<div className="credit-unavailable" role="alert"><strong>Credit position unavailable</strong><p>{error}</p></div>:!data?<p className="credit-loading" role="status">Checking invoices, payments and existing commitments…</p>:<>
      <div className="credit-identity"><strong>{data.customer_name}</strong><span>{data.company} · All amounts in {data.currency}</span><small>Checked {data.checked_at} · Refresh before approval</small></div>
      <div className="credit-metrics">
        <div><span>UNPAID INVOICES</span><strong>{money(data.unpaid_invoices)}</strong><small>{data.invoices.length} open invoices</small></div>
        <div className={data.overdue>0?'credit-attention':''}><span>OF WHICH, OVERDUE</span><strong>{money(data.overdue)}</strong><small>Due dates and instalments considered</small></div>
        <div><span>AVAILABLE CREDITS</span><strong>{money(data.available_credits)}</strong><small>Unallocated payments and credit balances</small></div>
        <div><span>CREDIT LIMIT</span><strong>{money(data.credit_limit)}</strong><small>{data.payment_terms||'Payment terms not configured'}</small></div>
      </div>
      <div className="credit-decision-grid"><div className="credit-calculation"><h3>Including this order</h3><dl>
        <div><dt>Posted customer balance <small>Payments and credits already included</small></dt><dd>{money(data.ledger_balance)}</dd></div>
        <div><dt>Other unbilled orders</dt><dd>{money(data.other_orders)}</dd></div>
        {data.unbilled_deliveries!==0&&<div><dt>Standalone unbilled deliveries</dt><dd>{money(data.unbilled_deliveries)}</dd></div>}
        <div><dt>{data.docstatus===0?'This new order':'Unbilled portion of this order'}</dt><dd>{money(data.this_order)}</dd></div>
        <div className="credit-projected"><dt>Total credit exposure</dt><dd>{money(data.projected_exposure)}</dd></div>
      </dl><p>Existing orders are counted once. Credit exposure is not an additional invoice or a payment request.</p></div>
      <div className={'credit-decision '+((data.over_limit||0)>0||data.overdue>0?'credit-needs-review':'')}><span className="eyebrow">REVIEWER’S CHECK</span>
        <h3>{(data.over_limit||0)>0?'Over the credit limit':data.overdue>0?'Unpaid amounts are overdue':data.credit_limit===null?'Credit limit not configured':'Within the configured limit'}</h3>
        <strong className="credit-headroom">{data.credit_limit===null?'Limit not set':money((data.over_limit||0)>0?data.over_limit:data.remaining_credit)}</strong>
        <p>{data.credit_limit===null?'Ask the authorized manager to confirm the customer’s credit terms.':(data.over_limit||0)>0?'Above the limit after including this order.':'Credit remaining after including this order.'}</p>
        {data.warnings.length>0&&<ul>{data.warnings.map(warning=><li key={warning}>{warning}</li>)}</ul>}
        <p className="credit-note">This review does not approve the order or bypass ERP credit controls.</p>
      </div></div>
      <details className="credit-invoices" open><summary>Unpaid invoices <span>{data.invoices.length}</span></summary>
        {data.invoices.length===0?<p className="credit-empty">No unpaid posted invoices for this customer in this company.</p>:<><div className="credit-table-scroll"><table><thead><tr><th>Invoice / date</th><th>Due</th><th className="number">Invoice total</th><th className="number">Still unpaid</th><th className="number">Overdue portion</th></tr></thead><tbody>
          {data.invoices.slice(0,visible).map(invoice=><tr key={invoice.name}><td><button type="button" className="credit-record" onClick={()=>onInvoice(invoice.name)}>{invoice.name} →</button><small>{invoice.posting_date}</small></td><td>{invoice.due_date||'Not set'}{invoice.overdue>0&&<small className="credit-overdue">{invoice.days_overdue>0?`${invoice.days_overdue} days past final due date`:'An instalment is overdue'}</small>}</td><td className="number">{money(invoice.invoice_total)}{invoice.original_currency!==data.currency&&<small>{invoice.original_currency} {invoice.original_total.toLocaleString('en-PH')}</small>}</td><td className="number"><strong>{money(invoice.outstanding)}</strong></td><td className="number">{money(invoice.overdue)}</td></tr>)}
        </tbody></table></div>{visible<data.invoices.length&&<button type="button" className="refresh" onClick={()=>setVisible(n=>n+20)}>Show 20 more invoices ({data.invoices.length-visible} remaining)</button>}</>}
      </details>
      {(data.orders.length>0||data.credits.length>0)&&<details className="credit-invoices"><summary>Existing orders & credit balances</summary><div className="credit-supporting">
        <div><h3>Other unbilled orders</h3>{data.orders.length?data.orders.map(order=><a key={order.name} href={'/desk/sales-order/'+encodeURIComponent(order.name)}><span>{order.name} ↗</span><strong>{money(order.unbilled)}</strong></a>):<p>None.</p>}</div>
        <div><h3>Credit balances</h3>{data.credits.length?data.credits.map(credit=><div key={credit.doctype+credit.name}><span>{credit.doctype} · {credit.name}</span><strong>{money(credit.amount)}</strong></div>):<p>None.</p>}</div>
      </div></details>}
      <footer className="credit-handoff"><div><strong>Prepare → Review → Approve in ERP</strong><p>Prepared by {data.prepared_by}. The reviewer checks balances and uses the existing order action.</p></div><a className="refresh" href={'/desk/sales-order/'+encodeURIComponent(name)}>{data.can_submit?'Open order for approval ↗':'Open saved order ↗'}</a></footer>
    </>}
  </section>;
}
