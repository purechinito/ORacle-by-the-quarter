import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { TransactionDetails } from './TransactionDetails';

type Section = 'sales' | 'purchasing' | 'receivables' | 'payables';
type RecordRow = {name: string; status: string; docstatus: number; currency: string; grand_total: number; modified: string; per_billed?: number; per_delivered?: number; per_received?: number; outstanding_amount?: number; [key: string]: string | number | undefined};
type Workspace = {user: {name: string; full_name: string}; companies: {name: string; default_currency: string}[]; company: string; section: Section; available_sections: Section[]; doctype: string; party_field: string; date_field: string; records: RecordRow[]; page: number; has_more: boolean};
const sections: Record<Section, {label: string; singular: string; route: string; icon: string; description: string}> = {
  sales: {label: 'Sales', singular: 'Sales order', route: 'sales-order', icon: '↗', description: 'Orders, delivery progress, and the next customer handoff.'},
  purchasing: {label: 'Purchasing', singular: 'Purchase order', route: 'purchase-order', icon: '↙', description: 'Supplier commitments, incoming stock, and billing progress.'},
  receivables: {label: 'Receivables', singular: 'Customer invoice', route: 'sales-invoice', icon: '＋', description: 'Customer invoices and the balances still to collect.'},
  payables: {label: 'Payables', singular: 'Supplier bill', route: 'purchase-invoice', icon: '−', description: 'Supplier bills and the balances still to settle.'},
};
const params = new URLSearchParams(location.search);
const initialSection = params.get('section') as Section;
function currency(value: number, code: string) { if(typeof value !== 'number' || typeof code !== 'string' || !/^[A-Z]{3}$/.test(code)) return 'Not available'; return new Intl.NumberFormat(undefined, {style:'currency', currency:code}).format(value); }
function date(value: unknown) { if (!value) return 'Not set'; if(Number.isNaN(new Date(String(value).slice(0,10)+'T12:00:00').valueOf())) return 'Not available'; return new Intl.DateTimeFormat(undefined, {day:'numeric',month:'short',year:'numeric'}).format(new Date(String(value).slice(0,10)+'T12:00:00')); }
function Progress({label, value}: {label: string; value: number}) { return <div className="progress"><div><span>{label}</span><strong>{Math.round(value)}%</strong></div><progress aria-label={label} value={value} max={100}/></div>; }
function App() {
  const [section,setSection] = useState<Section>(sections[initialSection] ? initialSection : 'sales');
  const [company,setCompany] = useState(params.get('company') || '');
  const [detail,setDetail] = useState(params.get('record') || '');
  const [search,setSearch] = useState('');
  const [query,setQuery] = useState('');
  const [openOnly,setOpenOnly] = useState(false);
  const [page,setPage] = useState(0);
  const [data,setData] = useState<Workspace|null>(null);
  const [selected,setSelected] = useState<string|null>(null);
  const [busy,setBusy] = useState(true);
  const [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  useEffect(() => {const timer = setTimeout(() => {setQuery(search);setPage(0);},250);return () => clearTimeout(timer);},[search]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 15000);
    setBusy(true); setError(''); setSelected(null);
    const queryParams = new URLSearchParams({section, company, search:query, page:String(page), open_only:openOnly?'1':'0'});
    fetch('/api/method/quarter_erp.api.workspace?'+queryParams, {credentials:'same-origin', signal:controller.signal, cache:'no-store'})
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 403 || response.status === 401 ? 'Your session or permissions do not allow this view. Sign in again or choose an authorized workspace.' : 'The workspace could not load. Please retry.');
        return response.json();
      }).then(result => {
        if (!active) return;
        const next: Workspace = result.message;
        setData(next); setSelected(next.records[0]?.name ?? null);

      }).catch(reason => {if(active){setError(reason.name === 'AbortError' ? 'The request timed out. Please retry when the ERP is available.' : reason.message);setData(null);}})
      .finally(() => {clearTimeout(timeout);if(active) setBusy(false);});
    return () => {active = false;clearTimeout(timeout);controller.abort();};
  },[section,company,query,page,openOnly,revision]);
  useEffect(()=>{const state = new URLSearchParams({section,company:company || data?.company || ''});if(detail)state.set('record',detail);history.replaceState(null,'','/orbit?'+state);},[section,company,data?.company,detail]);
  const config = sections[section];
  const record = data?.records.find(row => row.name === selected);
  function changeSection(next: Section) {setDetail('');setSection(next);setPage(0);setSearch('');setQuery('');}
  const native = (name: string) => '/desk/'+config.route+'/'+encodeURIComponent(name);
  const user = data?.user.full_name || 'Company workspace';
  return <div className="app">
    <a className="skip" href="#main">Skip to records</a>
    <aside className="sidebar">
      <a className="brand" href="/orbit"><span className="brand-mark">◒</span><span>orbit<small>COMPANY WORKSPACE</small></span></a>
      <div className="nav-label">OPERATIONS</div>
      <nav aria-label="Workspace">{Object.entries(sections).filter(([key]) => !data || data.available_sections.includes(key as Section)).map(([key,value]) => <button key={key} className={section === key ? 'nav-item active':'nav-item'} aria-current={section === key ? 'page':undefined} onClick={() => changeSection(key as Section)}><span className="nav-icon" aria-hidden="true">{value.icon}</span>{value.label}<span className="nav-dot"/></button>)}</nav>
      <div className="nav-rule"/>
      <a className="native-link" href="/desk"><span aria-hidden="true">▦</span> All ERP modules <span aria-hidden="true">↗</span></a>
      <p className="nav-help">Inventory, manufacturing, reports, and setup open in the full ERP.</p>
      <div className="sidebar-bottom"><span className="avatar">{user.slice(0,1)}</span><div><strong>{user}</strong><small>Current account permissions</small></div></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{config.label}</strong></div><div className="company"><label htmlFor="company">COMPANY</label><select id="company" value={company || data?.company || ''} onChange={e => {setDetail('');setCompany(e.target.value);setPage(0);}} disabled={!data || busy}>{data?.companies.map(item => <option key={item.name}>{item.name}</option>)}</select></div><a className="account-link" href="/me">Account ↗</a></header>
      <main id="main" tabIndex={-1}>
        {!detail && <div className="heading"><div><div className="eyebrow">YOUR OPERATIONS, CONNECTED</div><h1>{config.label} workspace<span>.</span></h1><p>{config.description}</p></div><button className="refresh" disabled={busy} onClick={() => setRevision(n=>n+1)}><span aria-hidden="true">↻</span> {busy?'Refreshing…':'Refresh'}</button></div>}
        {data?.company === 'Orbit Demo Company' && <div className="demo-note"><span className="demo-dot"/> Synthetic demo company <span className="demo-separator">/</span> Saved transactions in the live ERP. Account migration is pending.</div>}
        {detail ? <TransactionDetails key={section+detail+revision} section={section} name={detail} company={company || data?.company || ''} onBack={()=>setDetail('')} onNavigate={(next,name)=>{changeSection(next);setDetail(name);}}/> : <div className="work-area" aria-busy={busy}>
          <section className="records-panel" aria-label={config.label+' records'}>
            <div className="panel-title"><div><span className="section-number">01</span><h2>{config.singular}s</h2></div><a href={'/desk/'+config.route} className="text-link">Full list ↗</a></div>
            <div className="toolbar"><div className="segmented" aria-label="Record scope"><button aria-pressed={!openOnly} onClick={()=>{setOpenOnly(false);setPage(0);}}>All records</button><button aria-pressed={openOnly} onClick={()=>{setOpenOnly(true);setPage(0);}}>Open work</button></div><label className="search"><span aria-hidden="true">⌕</span><input aria-label="Search by record or party" placeholder="Find a record or company…" value={search} onChange={e=>setSearch(e.target.value)}/>{search && <button aria-label="Clear search" onClick={()=>setSearch('')}>×</button>}</label></div>
            <div className="table-scroll">{error ? <div className="empty" role="alert"><h3>We couldn’t open this view.</h3><p>{error}</p><button onClick={()=>setRevision(n=>n+1)}>Retry</button><a href="/login?redirect-to=%2Forbit">Sign in</a></div> : busy ? <div className="loading" role="status"><div className="loading-line"/><div className="loading-line"/><div className="loading-line"/><p>Loading authorized records…</p></div> : data?.records.length ? <table><thead><tr><th scope="col">Record / company</th><th scope="col">Status</th><th scope="col">Due / expected</th><th scope="col" className="number">Amount</th></tr></thead><tbody>{data.records.map(row => <tr key={row.name} className={selected === row.name?'selected':''}><td><button className="record-select" aria-pressed={selected === row.name} onClick={()=>setSelected(row.name)}><strong>{row.name}</strong><span>{row[data.party_field]}</span></button></td><td><span className={'status '+(row.docstatus === 2?'cancelled':row.status === 'Paid' || row.status === 'Completed'?'complete':'')}>{row.status}</span></td><td className="date">{date(row[data.date_field])}</td><td className="number"><strong>{currency(row.grand_total,row.currency)}</strong><small>{row.currency}</small></td></tr>)}</tbody></table> : <div className="empty"><span className="empty-icon">⌕</span><h3>No records in this view.</h3><p>Try another search or switch to all records.</p>{(search || openOnly) && <button onClick={()=>{setSearch('');setOpenOnly(false);setPage(0);}}>Clear filters</button>}</div>}</div>
            <footer className="table-footer"><span role="status">{!busy && data ? `${data.records.length} ${data.records.length === 1 ? "record" : "records"} · Page ${page+1}`:'Record access checked by the ERP'}</span><div><button disabled={busy || page===0} onClick={()=>setPage(n=>n-1)} aria-label="Previous page">←</button><button disabled={busy || !data?.has_more} onClick={()=>setPage(n=>n+1)} aria-label="Next page">→</button></div></footer>
          </section>
          <aside className="context" aria-label="Selected record"><div className="context-heading"><span className="section-number">02</span><h2>Record overview</h2></div>{record && !busy ? <><div className="context-type">{config.singular}</div><h3>{record.name}</h3><p className="party">{record[data!.party_field]}</p><div className="amount"><span>DOCUMENT TOTAL</span><strong>{currency(record.grand_total,record.currency)}</strong><small>{record.currency}</small></div><dl><div><dt>Status</dt><dd>{record.status}</dd></div><div><dt>{section === 'sales'?'Expected delivery':section === 'purchasing'?'Expected receipt':'Due date'}</dt><dd>{date(record[data!.date_field])}</dd></div><div><dt>Last updated</dt><dd>{date(record.modified)}</dd></div></dl>{record.per_billed !== undefined && <div className="progress-group"><h4>Fulfillment & billing</h4><Progress label={section==='sales'?'Delivered':'Received'} value={record.per_delivered ?? record.per_received ?? 0}/><Progress label="Billed" value={record.per_billed}/></div>}{record.outstanding_amount !== undefined && <div className="outstanding"><span>Remaining balance</span><strong>{currency(record.outstanding_amount,record.currency)}</strong></div>}<button className="primary" onClick={()=>setDetail(record.name)}>View transaction <span aria-hidden="true">→</span></button><a className="context-native" href={native(record.name)}>Open in full ERP ↗</a><p className="context-help">Review line items and linked documents here. Editing and posting actions remain in the full ERP.</p></> : <div className="context-placeholder"><span>◎</span><p>Select a record to see its progress and details.</p></div>}</aside>
        </div>}
        <footer className="page-footer"><span>ORBIT WORKSPACE <span className="footer-dot">•</span> Connected to ERPNext</span><span>One record. One source of truth.</span></footer>
      </main>
    </div>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App/>);
