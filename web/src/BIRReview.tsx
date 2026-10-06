import {useEffect, useRef, useState, type FormEvent} from 'react';
import './bir.css';
import {CompanyFooter} from './CompanyFooter';

type FiscalYear = {name:string; year_start_date:string; year_end_date:string};
type ReviewOptions = {
  user:string | {name:string; full_name?:string};
  companies:{name:string; default_currency:string; country:string}[];
  fiscal_years:FiscalYear[];
  can_configure:boolean;
  csrf_token:string;
};
type Filters = {company:string; from_date:string; to_date:string; fiscal_year:string};
const profileFields = [
  {key:'legal_name', label:'Registered legal name', wide:true},
  {key:'tin', label:'Taxpayer identification number (TIN)'},
  {key:'branch_code', label:'Branch code'},
  {key:'registered_address', label:'Registered address', multiline:true, wide:true},
  {key:'rdo_code', label:'Revenue District Office (RDO) code'},
  {key:'vat_status', label:'VAT registration status'},
  {key:'fiscal_year_end', label:'Fiscal year end (MM-DD)', hint:'Use the registered month and day, for example 12-31.'},
  {key:'cas_reference', label:'CAS registration reference', wide:true},
  {key:'books_reference', label:'Books registration reference', wide:true},
  {key:'invoice_series', label:'Registered invoice series', wide:true},
  {key:'accountant_name', label:'Reviewing accountant'},
  {key:'accountant_review_date', label:'Accountant review date', date:true},
  {key:'registration_notes', label:'Registration and review notes', multiline:true, wide:true},
] as const;
type ProfileKey = typeof profileFields[number]['key'];
type ProfileValues = Record<ProfileKey,string>;
type TaxpayerProfile = Partial<ProfileValues> & {name:string; modified:string};
type ReviewCheck = {id:string; title:string; status:'blocked'|'review'|'checked'; detail:string};
type Report = {id:string; title:string; columns:{fieldname:string; label:string; fieldtype:string}[]; rows:Record<string,unknown>[]; message?:string};
type Invoice = {doctype:string; name:string; posting_date:string; party:string; currency:string; grand_total:string|number; base_grand_total:string|number; tax_total:string|number; attachment_count:number; bill_no?:string; bill_date?:string};
type Review = Filters & {
  currency:string; country:string; finance_book_scope:string; generated_at:string;
  profile:TaxpayerProfile|null; checks:ReviewCheck[];
  summary:{gl_debit:string; gl_credit:string; gl_difference:string; invoice_count:number; missing_evidence_count:number};
  reports:Report[]; invoices:Invoice[];
};
const API = '/api/method/quarter_erp.bir.';
const ROW_LIMIT = 100;
const emptyFilters:Filters = {company:'', from_date:'', to_date:'', fiscal_year:''};
const routes:Record<string,string> = {
  'Sales Invoice':'sales-invoice', 'Purchase Invoice':'purchase-invoice',
  'Journal Entry':'journal-entry', 'Payment Entry':'payment-entry',
  'Delivery Note':'delivery-note', 'Purchase Receipt':'purchase-receipt',
  'Stock Entry':'stock-entry', 'Sales Order':'sales-order', 'Purchase Order':'purchase-order',
  'Orbit Taxpayer Profile':'orbit-taxpayer-profile',
};
const checkLabels = {blocked:'Unresolved requirement', review:'Needs review', checked:'Check recorded'};

// Business data is inert React text. Literal angle brackets and entities are data.
function text(value:unknown):string {
  if(value===null || value===undefined || value==='') return '—';
  return typeof value==='object' ? JSON.stringify(value) : String(value);
}
// Only native presentation fields (labels/messages) are stripped of HTML formatting.
function presentationText(value:unknown):string {
  const source = text(value);
  if(!/[<>&]/.test(source)) return source;
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  parsed.querySelectorAll('script,style,template').forEach(element=>element.remove());
  return parsed.body.textContent?.trim() || '—';
}
function profileValues(profile:TaxpayerProfile|null):ProfileValues {
  return Object.fromEntries(profileFields.map(field=>[field.key, profile?.[field.key] || (field.key==='vat_status'?'Unconfirmed':'')])) as ProfileValues;
}
function confirmDraftReplacement(dirty:boolean, saving:boolean):boolean {
  if(saving) return false;
  return !dirty || window.confirm('Discard unsaved registration profile changes?\n\nContinuing will replace your form values. Choose Cancel to keep editing or save the profile first.');
}
function nativeLink(doctype:unknown, name:unknown):string|null {
  if(typeof doctype!=='string' || !Object.hasOwn(routes,doctype) || typeof name!=='string' || !name.trim() || /^[.]{1,2}$/.test(name) || /[\u0000-\u001f]/.test(name)) return null;
  return '/app/'+routes[doctype]+'/'+encodeURIComponent(name);
}
function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
function validISO(value:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value+'T12:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0,10)===value;
}
function periodError(filters:Filters, years:FiscalYear[]) {
  const year = years.find(item=>item.name===filters.fiscal_year);
  if(!filters.company || !year) return 'Select an authorized company and fiscal year.';
  if(!validISO(filters.from_date) || !validISO(filters.to_date)) return 'Enter valid start and end dates.';
  if(filters.from_date>filters.to_date) return 'The start date must be on or before the end date.';
  if(filters.from_date<year.year_start_date || filters.to_date>year.year_end_date) return 'Keep both dates within the selected fiscal year.';
  return '';
}
class RequestError extends Error {
  constructor(message:string, public status:number) { super(message); }
}
async function request<T>(method:string, signal:AbortSignal, init:RequestInit = {}):Promise<T> {
  const response = await fetch(API+method, {...init, credentials:'same-origin', cache:'no-store', signal});
  const payload = await response.json().catch(()=>null);
  if(!response.ok) {
    let detail = 'The ERP could not complete this request. Please retry.';
    if(response.status===401 || response.status===403) detail = 'Your session or permissions do not allow this action. Sign in with an authorized account.';
    else if(response.status===409) detail = 'This taxpayer profile changed after you opened it. Your changes have not been saved.';
    else {
      try {
        const messages:unknown[] = JSON.parse(payload?._server_messages || '[]');
        const message = messages.map(item=>typeof item==='string'?JSON.parse(item).message:'').filter(Boolean).map(presentationText).join(' ');
        if(message) detail = message.slice(0,1200);
      } catch { /* A server traceback is not useful review guidance. */ }
    }
    throw new RequestError(detail,response.status);
  }
  if(!payload || payload.message===undefined) throw new RequestError('The ERP returned an incomplete response. Please retry.',response.status);
  return payload.message as T;
}
function failure(reason:unknown, action:string) {
  if(reason instanceof Error && reason.name==='AbortError') return `${action} took too long. Please retry when the ERP is available.`;
  return reason instanceof RequestError ? reason.message : 'Could not connect to the ERP. Check your connection and retry.';
}
function Voucher({doctype, name}:{doctype:unknown; name:unknown}) {
  const href = nativeLink(doctype,name);
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${text(doctype)} ${text(name)} in full ERP, new tab`}>{text(name)} <span aria-hidden="true">↗</span></a> : <>{text(name)}</>;
}
function ReportTable({report}:{report:Report}) {
  return <>
    <div className="bir-report-caption"><h3>{text(report.title)}</h3><span>Showing {Math.min(report.rows.length,ROW_LIMIT).toLocaleString()} of {report.rows.length.toLocaleString()} rows</span></div>
    {report.message && <p className="bir-native-message">{presentationText(report.message)}</p>}
    {report.rows.length ? <div className="bir-table-scroll" role="region" aria-label={`${text(report.title)} table; scroll for all columns`} tabIndex={0}>
      <table><caption className="bir-sr-only">{text(report.title)}. First {ROW_LIMIT} rows at most; the review pack includes all returned rows.</caption><thead><tr>{report.columns.map((column,index)=><th scope="col" key={`${column.fieldname}-${index}`} className={['Currency','Float','Int','Percent'].includes(column.fieldtype)?'bir-numeric':''}>{presentationText(column.label || column.fieldname)}</th>)}</tr></thead>
        <tbody>{report.rows.slice(0,ROW_LIMIT).map((row,index)=><tr key={index}>{report.columns.map((column,columnIndex)=>{
          const voucher = column.fieldname==='voucher_no' ? {doctype:row.voucher_type,name:row[column.fieldname]} : column.fieldname==='against_voucher' ? {doctype:row.against_voucher_type,name:row[column.fieldname]} : null;
          return <td key={`${column.fieldname}-${columnIndex}`} className={['Currency','Float','Int','Percent'].includes(column.fieldtype)?'bir-numeric':''}>{voucher ? <Voucher {...voucher}/> : text(row[column.fieldname])}</td>;
        })}</tr>)}</tbody></table>
    </div> : <div className="bir-empty"><strong>No report rows for this period.</strong><p>The native report returned no rows under the selected filters.</p></div>}
    <p className="bir-table-note">Native ERPNext report · display limited to 100 rows · exports include the complete report.</p>
  </>;
}

export function BIRReview() {
  const [options,setOptions] = useState<ReviewOptions|null>(null);
  const [optionsBusy,setOptionsBusy] = useState(true);
  const [optionsError,setOptionsError] = useState('');
  const [optionsRevision,setOptionsRevision] = useState(0);
  const [filters,setFilters] = useState<Filters>(emptyFilters);
  const [result,setResult] = useState<Review|null>(null);
  const [draft,setDraft] = useState<ProfileValues>(profileValues(null));
  const [reviewBusy,setReviewBusy] = useState(false);
  const [reviewError,setReviewError] = useState('');
  const [saving,setSaving] = useState(false);
  const [saveError,setSaveError] = useState('');
  const [saveNotice,setSaveNotice] = useState('');
  const [conflict,setConflict] = useState(false);
  const [activeReport,setActiveReport] = useState('general_ledger');
  const reviewSequence = useRef(0);
  const saveSequence = useRef(0);
  const reviewRequest = useRef<AbortController|null>(null);
  const saveRequest = useRef<AbortController|null>(null);
  const saveInFlight = useRef(false);
  const resultsHeading = useRef<HTMLHeadingElement>(null);

  useEffect(()=>{
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),20000);
    setOptionsBusy(true);setOptionsError('');
    request<ReviewOptions>('options',controller.signal).then(data=>{
      if(!active) return;
      setOptions(data);
      const today = todayISO();
      const years = [...data.fiscal_years].sort((a,b)=>b.year_start_date.localeCompare(a.year_start_date));
      const year = years.find(item=>item.year_start_date<=today && item.year_end_date>=today) || years[0];
      setFilters({company:data.companies[0]?.name || '', fiscal_year:year?.name || '', from_date:year?.year_start_date || '', to_date:year?.year_end_date || ''});
    }).catch(reason=>{if(active)setOptionsError(failure(reason,'Loading review access'));})
      .finally(()=>{clearTimeout(timer);if(active)setOptionsBusy(false);});
    return ()=>{active=false;clearTimeout(timer);controller.abort();};
  },[optionsRevision]);
  useEffect(()=>()=>{
    ++reviewSequence.current;++saveSequence.current;
    reviewRequest.current?.abort();saveRequest.current?.abort();
  },[]);

  function changeFilters(next:Filters) {
    if(Object.entries(next).every(([key,value])=>filters[key as keyof Filters]===value)) return;
    if(!confirmDraftReplacement(dirty,saveInFlight.current)) return;
    ++reviewSequence.current;
    reviewRequest.current?.abort();
    setFilters(next);setResult(null);setDraft(profileValues(null));
    setReviewBusy(false);setReviewError('');setSaveError('');setSaveNotice('');setConflict(false);
  }
  async function loadReview(focus=true, afterSave=false) {
    if(!options) return false;
    if(!afterSave && !confirmDraftReplacement(dirty,saveInFlight.current)) return false;
    const validation = periodError(filters,options.fiscal_years);
    if(validation) {setReviewError(validation);return false;}
    const token = ++reviewSequence.current;
    reviewRequest.current?.abort();
    const controller = new AbortController();reviewRequest.current=controller;
    const timer = setTimeout(()=>controller.abort(),45000);
    if(!afterSave)setSaveNotice('');
    setReviewBusy(true);setReviewError('');setResult(null);setSaveError('');setConflict(false);
    try {
      const data = await request<Review>('review?'+new URLSearchParams(filters),controller.signal);
      if(token!==reviewSequence.current) return false;
      // Reject a mismatched response rather than show another period under these controls.
      if(Object.entries(filters).some(([key,value])=>data[key as keyof Filters]!==value)) throw new RequestError('The returned review did not match the selected company and period. Please retry.',409);
      setResult(data);setDraft(profileValues(data.profile));
      setActiveReport(current=>data.reports.some(report=>report.id===current)?current:data.reports[0]?.id || 'general_ledger');
      if(focus) requestAnimationFrame(()=>{if(token===reviewSequence.current)resultsHeading.current?.focus();});
      return true;
    } catch(reason) {if(token===reviewSequence.current)setReviewError(failure(reason,'Preparing the review'));return false;}
    finally {clearTimeout(timer);if(token===reviewSequence.current)setReviewBusy(false);}
  }
  async function saveProfile(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!options?.can_configure || !result || saveInFlight.current || conflict) return;
    saveInFlight.current=true;
    const token = ++saveSequence.current;
    saveRequest.current?.abort();
    const controller = new AbortController();saveRequest.current=controller;
    const timer = setTimeout(()=>controller.abort(),30000);
    setSaving(true);setSaveError('');setSaveNotice('');
    try {
      await request<TaxpayerProfile>('save_profile',controller.signal,{
        method:'POST',headers:{'Content-Type':'application/json','X-Frappe-CSRF-Token':options.csrf_token},
        body:JSON.stringify({company:result.company, values:draft, expected_modified:result.profile?.modified || null}),
      });
      if(token!==saveSequence.current) return;
      setSaveNotice('Taxpayer profile saved. Review checks are being refreshed.');
      // This refresh follows a confirmed save, so there is no unsaved draft to discard.
      const refreshed = await loadReview(false,true);
      if(token===saveSequence.current)setSaveNotice(refreshed?'Taxpayer profile saved and review checks refreshed.':'Taxpayer profile saved. Retry the review to refresh its reports and checks.');
    } catch(reason) {
      if(token!==saveSequence.current) return;
      setConflict(reason instanceof RequestError && reason.status===409);
      setSaveError(failure(reason,'Saving the profile'));
    } finally {clearTimeout(timer);if(token===saveSequence.current){saveInFlight.current=false;setSaving(false);}}
  }
  const year = options?.fiscal_years.find(item=>item.name===filters.fiscal_year);
  const company = options?.companies.find(item=>item.name===filters.company);
  const validation = options ? periodError(filters,options.fiscal_years) : '';
  const report = result?.reports.find(item=>item.id===activeReport) || result?.reports[0];
  const blocked = result?.checks.filter(check=>check.status==='blocked').length || 0;
  const needsReview = result?.checks.filter(check=>check.status==='review').length || 0;
  const checked = result?.checks.filter(check=>check.status==='checked').length || 0;
  const savedValues = profileValues(result?.profile || null);
  const dirty = !!result && profileFields.some(field=>draft[field.key]!==savedValues[field.key]);
  const user = typeof options?.user==='string' ? options.user : options?.user.full_name || options?.user.name;
  const exportURL = result ? API+'export_pack?'+new URLSearchParams({company:result.company,from_date:result.from_date,to_date:result.to_date,fiscal_year:result.fiscal_year}) : '';

  return <div className="bir-page">
    <a className="skip" href="#bir-main">Skip to Philippine VAT accounting</a>
    <header className="bir-top"><a className="brand draft-brand" href="/orbit"><span className="brand-mark" aria-hidden="true">◒</span><span>orbit<small>COMPANY WORKSPACE</small></span></a><a className="bir-back" href="/orbit?section=sales">← Transactions</a></header>
    <main id="bir-main" className="bir-main">
      <div className="bir-intro"><div><div className="bir-eyebrow">COMPANY BOOKS · BIR REVIEW</div><h1>Philippine VAT accounting<span>.</span></h1><p>Prepare BIR review material from each company’s books, supporting records, and registration details.</p></div><span className="bir-preparation-label"><span aria-hidden="true">◎</span> Preparation only</span></div>
      <p className="bir-boundary">This workspace prepares material for your accountant. It does not register books or CAS, certify invoices, or file a tax return.</p>
      {optionsBusy && <div className="bir-loading" role="status">Loading authorized companies and fiscal years…</div>}
      {optionsError && <div className="bir-error" role="alert"><strong>Review access could not load.</strong><p>{optionsError}</p><div className="bir-actions"><button className="bir-button" onClick={()=>setOptionsRevision(value=>value+1)}>Retry access check</button><a href="/login?redirect-to=%2Forbit%3Fview%3Dbir">Sign in ↗</a></div></div>}
      {options && options.companies.length===0 && <section className="bir-setup" aria-labelledby="bir-setup-title">
        <div className="bir-setup-intro"><span className="bir-eyebrow">START WITH YOUR REGISTERED ENTITIES</span><h2 id="bir-setup-title">Set up your Philippine companies</h2><p>No Philippine company is available to this account yet. Begin with the registered details for each legal entity.</p><div className="bir-setup-context"><span>User-confirmed business context</span><strong>Five VAT-registered legal entities · Cebu</strong><p>Each company’s registration details still need to be recorded from its own documents.</p></div></div>
        <div className="bir-setup-steps">
          <div><span className="bir-setup-number" aria-hidden="true">01</span><div><h3>Use the Certificate of Registration</h3><p>Enter the actual registered legal name, TIN, branch code, registered address, and exact RDO code from each BIR Certificate of Registration (COR). Cebu alone does not identify the RDO.</p></div></div>
          <div><span className="bir-setup-number" aria-hidden="true">02</span><div><h3>Confirm the owning entity before posting</h3><p>Your bookkeeper should select the documented owning legal entity for each transaction. Unclear ownership requires review before posting.</p></div></div>
          <div><span className="bir-setup-number" aria-hidden="true">03</span><div><h3>Reconcile complete company records</h3><p>Keep each company’s records complete and reconcile them to their source documents, bank records, and supporting evidence.</p></div></div>
        </div>
        <div className="bir-setup-actions">{options.can_configure?<><p>Open the ERP company records to configure each legal entity with country Philippines. Return here and refresh after saving.</p><div className="bir-actions"><a className="bir-button bir-primary" href="/app/company" target="_blank" rel="noopener noreferrer">Open company setup <span aria-hidden="true">↗</span><span className="bir-sr-only"> (opens in a new tab)</span></a><button className="bir-button" disabled={optionsBusy} onClick={()=>setOptionsRevision(value=>value+1)}>{optionsBusy?'Refreshing setup…':'Refresh setup'}</button></div></>:<p>Contact your account manager to configure the Philippine companies and confirm your access. Have each entity’s Certificate of Registration ready.</p>}</div>
      </section>}
      {options && options.companies.length>0 && <>
        {!options.fiscal_years.length && <div className="bir-error" role="alert"><strong>A fiscal year is needed for review.</strong><p>Ask your ERP administrator to configure an applicable fiscal year for these company records.</p></div>}
        <form className="bir-filters" onSubmit={event=>{event.preventDefault();void loadReview();}} aria-label="Review company and period">
          <div className="bir-filter-grid">
            <label className="bir-company-field">Company<select value={filters.company} onChange={event=>changeFilters({...filters,company:event.target.value})} disabled={saving || !options.companies.length}>{!options.companies.length && <option value="">No authorized company</option>}{options.companies.map(item=><option key={item.name} value={item.name}>{item.name}</option>)}</select><small>{company ? `${company.default_currency} · ${company.country || 'Country not set'}` : 'Company access is checked by the ERP.'}</small></label>
            <label>Fiscal year<select value={filters.fiscal_year} onChange={event=>{const next=options.fiscal_years.find(item=>item.name===event.target.value);changeFilters({...filters,fiscal_year:next?.name || '',from_date:next?.year_start_date || '',to_date:next?.year_end_date || ''});}} disabled={saving || !options.fiscal_years.length}>{!options.fiscal_years.length && <option value="">No fiscal year</option>}{options.fiscal_years.map(item=><option key={item.name} value={item.name}>{item.name}</option>)}</select><small>{year ? `${year.year_start_date} — ${year.year_end_date}` : 'Choose a configured fiscal year.'}</small></label>
            <label>From date<input type="date" disabled={saving} value={filters.from_date} min={year?.year_start_date} max={year?.year_end_date} required onChange={event=>changeFilters({...filters,from_date:event.target.value})}/></label>
            <label>To date<input type="date" disabled={saving} value={filters.to_date} min={year?.year_start_date} max={year?.year_end_date} required onChange={event=>changeFilters({...filters,to_date:event.target.value})}/></label>
          </div>
          <div className="bir-filter-footer"><div className="bir-presets"><span>Period shortcuts</span><button type="button" disabled={saving || !year} onClick={()=>{if(year)changeFilters({...filters,from_date:year.year_start_date,to_date:year.year_end_date});}}>Full fiscal year</button><button type="button" disabled={saving || !year || todayISO()<year.year_start_date} onClick={()=>{if(year)changeFilters({...filters,from_date:year.year_start_date,to_date:todayISO()>year.year_end_date?year.year_end_date:todayISO()});}}>Fiscal year to date</button></div><button className="bir-button bir-primary" type="submit" disabled={!!validation || reviewBusy || saving}>{reviewBusy?'Preparing review…':result?'Refresh review ↻':'Prepare review →'}</button></div>
          {validation && <p className="bir-validation" role="status">{validation}</p>}
        </form>
        {reviewError && <div className="bir-error" role="alert"><strong>The review could not be prepared.</strong><p>{reviewError}</p><div className="bir-actions"><button className="bir-button" disabled={saving || !!validation || reviewBusy} onClick={()=>void loadReview()}>Retry review</button><a href="/login?redirect-to=%2Forbit%3Fview%3Dbir">Sign in</a></div></div>}
        {saveNotice && <p className="bir-save-notice" role="status">{saveNotice}</p>}
        {reviewBusy && <div className="bir-loading" role="status"><span className="bir-loading-mark" aria-hidden="true"/>Preparing the company’s native reports and evidence checks…</div>}
        {!result && !reviewBusy && !reviewError && <section className="bir-start"><span aria-hidden="true">01 / 03</span><div><h2>Begin with a company and period.</h2><p>Prepare a review to see registration gaps, native accounting reports, and invoice attachment counts together.</p></div><ol><li>Review the requirements</li><li>Check the books and evidence</li><li>Download the review pack</li></ol></section>}
      </>}
      {result && <>
        <section className="bir-readiness" aria-labelledby="bir-readiness-title">
          <div className="bir-section-heading"><div><div className="bir-eyebrow">01 / PREPARATION CHECKS</div><h2 id="bir-readiness-title" ref={resultsHeading} tabIndex={-1}>{blocked ? `${blocked} unresolved requirement${blocked===1?'':'s'}` : needsReview ? `${needsReview} item${needsReview===1?'':'s'} need review` : 'Checks recorded. Professional review remains.'}</h2><p>{result.company} · {result.from_date} to {result.to_date}</p></div><div className="bir-check-counts"><span><b>{blocked}</b> unresolved</span><span><b>{needsReview}</b> to review</span><span><b>{checked}</b> recorded</span></div></div>
          <div className="bir-check-grid">{result.checks.map(check=><article className={'bir-check bir-check-'+check.status} key={check.id}><span className="bir-check-symbol" aria-hidden="true">{check.status==='blocked'?'!':check.status==='review'?'○':'✓'}</span><div><span className="bir-check-label">{checkLabels[check.status]}</span><h3>{text(check.title)}</h3><p>{text(check.detail)}</p></div></article>)}</div>
          {!result.checks.length && <p className="bir-native-message">No preparation checks were returned. Treat readiness as unconfirmed.</p>}
          <p className="bir-readiness-note">Recorded checks describe the available data. Registration, invoice validity, tax treatment, filing obligations, and accountant review require their own supporting evidence.</p>
        </section>
        <div className="bir-summary" aria-label="Accounting review totals"><div><span>GENERAL LEDGER DEBITS</span><strong>{text(result.summary.gl_debit)}</strong><small>{result.currency}</small></div><div><span>GENERAL LEDGER CREDITS</span><strong>{text(result.summary.gl_credit)}</strong><small>{result.currency}</small></div><div><span>DEBIT / CREDIT DIFFERENCE</span><strong>{text(result.summary.gl_difference)}</strong><small>A balance is not a compliance finding.</small></div><div><span>INVOICE EVIDENCE</span><strong>{result.summary.missing_evidence_count.toLocaleString()} <em>without attachments</em></strong><small>{result.summary.invoice_count.toLocaleString()} invoices in scope</small></div></div>
        <div className="bir-workbench">
          <section className="bir-profile bir-surface" aria-labelledby="bir-profile-title"><div className="bir-section-heading"><div><div className="bir-eyebrow">02 / TAXPAYER RECORD</div><h2 id="bir-profile-title">Registration profile</h2></div><span className="bir-readonly-label">{options?.can_configure?'Editable profile':'Read-only profile'}</span></div><p className="bir-description">Use details from your registration documents. Leave unknown values blank; saving a profile does not verify registration.</p>
            {!result.profile && <p className="bir-native-message">No taxpayer profile is saved for this company.</p>}
            {saveError && <div className="bir-error" role="alert"><strong>{conflict?'The saved profile has changed.':'Profile could not be saved.'}</strong><p>{saveError}</p>{conflict && <><p>Reloading replaces the unsaved values in this form with the latest saved profile.</p><button className="bir-button" disabled={saving} onClick={()=>void loadReview(false)}>Discard edits & reload latest</button></>}</div>}
            <form onSubmit={event=>void saveProfile(event)}><fieldset disabled={!options?.can_configure || saving || conflict}><legend className="bir-sr-only">Taxpayer registration details for {result.company}</legend><div className="bir-profile-grid">{profileFields.map(field=><label key={field.key} className={'wide' in field?'bir-field-wide':''} htmlFor={'bir-'+field.key}>{field.label}{field.key==='vat_status'?<select id={'bir-'+field.key} value={draft[field.key]} onChange={event=>{setDraft({...draft,[field.key]:event.target.value});setSaveNotice('');}}><option>Unconfirmed</option><option>VAT</option><option>Non-VAT</option></select>:'multiline' in field?<textarea id={'bir-'+field.key} rows={field.key==='registration_notes'?4:3} value={draft[field.key]} onChange={event=>{setDraft({...draft,[field.key]:event.target.value});setSaveNotice('');}}/>:<input id={'bir-'+field.key} type={'date' in field?'date':'text'} value={draft[field.key]} autoComplete="off" pattern={field.key==='fiscal_year_end'?'(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])':undefined} maxLength={field.key==='fiscal_year_end'?5:undefined} aria-describedby={'hint' in field?'bir-hint-'+field.key:undefined} onChange={event=>{setDraft({...draft,[field.key]:event.target.value});setSaveNotice('');}}/>}{'hint' in field && <small id={'bir-hint-'+field.key}>{field.hint}</small>}</label>)}</div></fieldset>
              <div className="bir-profile-footer">{options?.can_configure?<><p>{dirty?'Unsaved profile changes.':'Only authorized profile changes are saved.'}</p><button className="bir-button bir-primary" type="submit" disabled={saving || conflict || !dirty || reviewBusy}>{saving?'Saving profile…':'Save profile'}</button></>:<p>Your current account can inspect this profile. An authorized accountant or manager can update it.</p>}</div>
              {result.profile?.modified && <p className="bir-profile-modified">Last saved: {text(result.profile.modified)}</p>}
              {result.profile?.name && <a className="bir-profile-record" href={nativeLink('Orbit Taxpayer Profile',result.profile.name) || undefined} target="_blank" rel="noopener noreferrer">Registration record & attachments <span aria-hidden="true">↗</span><span className="bir-sr-only"> (opens in a new tab)</span></a>}
            </form>
          </section>
          <section className="bir-reports bir-surface" aria-labelledby="bir-reports-title"><div className="bir-section-heading"><div><div className="bir-eyebrow">03 / BOOKS & SUPPORTING RECORDS</div><h2 id="bir-reports-title">Accounting reports</h2></div><span className="bir-currency-label">{result.currency}</span></div><p className="bir-description">{text(result.finance_book_scope)}. Amounts come from the native ERP reports.</p><nav className="bir-report-nav" aria-label="Choose accounting report">{result.reports.map(item=><button key={item.id} aria-pressed={report?.id===item.id} onClick={()=>setActiveReport(item.id)}>{text(item.title)}</button>)}</nav>{report?<ReportTable report={report}/>:<div className="bir-empty">No native accounting reports were returned.</div>}
            <div className="bir-evidence-heading"><h3>Invoice evidence</h3><span>{result.invoices.length.toLocaleString()} records</span></div><p className="bir-evidence-note">Visible attachments show evidence presence, not proof of a valid VAT invoice or entitlement to an input-tax credit.</p>
            {result.invoices.length ? <><div className="bir-table-scroll" role="region" aria-label="Invoice evidence table; scroll for all columns" tabIndex={0}><table><caption className="bir-sr-only">Invoice evidence. Showing first {Math.min(result.invoices.length,ROW_LIMIT)} of {result.invoices.length} records.</caption><thead><tr><th scope="col">Invoice / posting date</th><th scope="col">Customer / supplier</th><th scope="col" className="bir-numeric">Invoice total</th><th scope="col" className="bir-numeric">Total · {result.currency}</th><th scope="col">Visible attachments</th><th scope="col">Supplier bill reference</th></tr></thead><tbody>{result.invoices.slice(0,ROW_LIMIT).map(invoice=><tr key={invoice.doctype+':'+invoice.name}><td><span className="bir-voucher-type">{text(invoice.doctype)}</span><Voucher doctype={invoice.doctype} name={invoice.name}/><small>{text(invoice.posting_date)}</small></td><td>{text(invoice.party)}</td><td className="bir-numeric">{text(invoice.grand_total)}<small>{text(invoice.currency)}</small></td><td className="bir-numeric">{text(invoice.base_grand_total)}</td><td><span className={invoice.attachment_count?'bir-evidence-count':'bir-evidence-missing'}>{invoice.attachment_count.toLocaleString()} {invoice.attachment_count===1?'attachment':'attachments'}</span></td><td>{text(invoice.bill_no)}{invoice.bill_date && <small>{text(invoice.bill_date)}</small>}</td></tr>)}</tbody></table></div><p className="bir-table-note">Showing {Math.min(result.invoices.length,ROW_LIMIT).toLocaleString()} of {result.invoices.length.toLocaleString()} invoice records. The pack includes the complete evidence index.</p></>:<div className="bir-empty"><strong>No invoices in this period.</strong><p>Invoice evidence checks cover the selected company and dates.</p></div>}
          </section>
        </div>
        <section className="bir-export" aria-labelledby="bir-export-title"><div><span className="bir-eyebrow">PREPARE A REVIEW PACK</span><h2 id="bir-export-title">Take the review to your accountant.</h2><p>Downloading regenerates complete reports from current saved data under these exact filters, with a new generation time in the manifest. It is a preparation pack, not a tax return.</p><dl><div><dt>Preview generated</dt><dd>{text(result.generated_at)}</dd></div><div><dt>Finance-book scope</dt><dd>{text(result.finance_book_scope)}</dd></div><div><dt>Company / fiscal year</dt><dd>{result.company} / {result.fiscal_year}</dd></div></dl>{dirty && <p className="bir-export-warning">Save the profile before exporting. To discard unsaved edits, refresh the review.</p>}</div>{dirty || saving?<button className="bir-button bir-download" disabled>Download review pack <span aria-hidden="true">↓</span></button>:<a className="bir-button bir-download" href={exportURL} download>Download review pack <span aria-hidden="true">↓</span></a>}</section>
      </>}
      <CompanyFooter note={user?`Signed in as ${text(user)}`:'Current account permissions apply'}/>
    </main>
  </div>;
}
