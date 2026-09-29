import {useEffect, useRef, useState} from 'react';
import './migration.css';

type Field = {key:string; label:string; required:boolean; default?:string; reference?:string};
type Schema = {label:string; fields:Field[]};
type Options = {kinds:Record<string,Schema>; companies:{name:string}[]; max_bytes:number; max_rows:number; csrf_token:string};
type Profile = {headers:string[]; row_count:number; sample:string[][]; mapping:Record<string,string>};
type Issue = {row:number; field:string; code:string; message:string};
type Result = {row_count:number; valid_count:number; invalid_count:number; issue_count:number; issues:Issue[]; issues_truncated:boolean; unmapped_columns:string[]; fingerprint:string; checked_at:string; limitations:string[]; sample:{row:number; values:Record<string,string>}[]};
const api = '/api/method/quarter_erp.migration.';
const examples:Record<string,string> = {
  customers:'source_id,customer_name,customer_group,territory,tax_id\n000101,Sample Cebu Manufacturing,All Customer Groups,All Territories,\n000102,Sample Mandaue Trading,All Customer Groups,All Territories,',
  suppliers:'source_id,supplier_name,supplier_group,tax_id\n000201,Sample Steel Supplier,All Supplier Groups,\n000202,Sample Packaging Supplier,All Supplier Groups,',
  items:'source_id,item_code,item_name,item_group,stock_uom,is_stock_item\n000301,SAMPLE-RAW-01,Sample raw material,All Item Groups,Nos,1\n000302,SAMPLE-FG-01,Sample finished product,All Item Groups,Nos,1',
};
function download(name:string, text:string, type:string) {
  const url=URL.createObjectURL(new Blob([text],{type}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function message(data:{_server_messages?:string}, status:number) {
  if(status===401 || status===403)return 'Your session or permissions do not allow migration preview. Sign in with an authorized system manager account.';
  try {const list:string[]=JSON.parse(data._server_messages || '[]');const value=list.map(s=>JSON.parse(s).message).join(' ');return new DOMParser().parseFromString(value,'text/html').body.textContent?.slice(0,1000) || 'The preview could not be completed. Please retry.';}
  catch {return 'The preview could not be completed. Please retry.';}
}

export function MigrationPreview() {
  const [options,setOptions]=useState<Options|null>(null);
  const [kind,setKind]=useState('customers');const [company,setCompany]=useState('');
  const [content,setContent]=useState('');const [filename,setFilename]=useState('');
  const [profile,setProfile]=useState<Profile|null>(null);const [mapping,setMapping]=useState<Record<string,string>>({});
  const [result,setResult]=useState<Result|null>(null);const [step,setStep]=useState(0);
  const [busy,setBusy]=useState('Loading migration access…');const [error,setError]=useState('');const [revision,setRevision]=useState(0);
  const sequence=useRef(0);const request=useRef<AbortController|null>(null);const heading=useRef<HTMLHeadingElement>(null);
  const schema=options?.kinds[kind];
  useEffect(()=>{
    const controller=new AbortController();const token=++sequence.current;request.current=controller;
    setBusy('Loading migration access…');setError('');const timer=setTimeout(()=>controller.abort(),20000);
    fetch(api+'options',{credentials:'same-origin',cache:'no-store',signal:controller.signal})
      .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(message(data,response.status));return data.message as Options;})
      .then(data=>{if(token!==sequence.current)return;setOptions(data);setKind(Object.keys(data.kinds)[0] || '');setCompany(data.companies[0]?.name || '');})
      .catch(e=>{if(token===sequence.current)setError(e.name==='AbortError'?'Access check timed out. Retry when the ERP is available.':e.message);})
      .finally(()=>{clearTimeout(timer);if(token===sequence.current)setBusy('');});
    return ()=>{++sequence.current;controller.abort();request.current?.abort();clearTimeout(timer);};
  },[revision]);
  useEffect(()=>{heading.current?.focus();},[step]);
  function invalidate(clearProfile=false) {
    ++sequence.current;request.current?.abort();setBusy('');setError('');setResult(null);
    if(clearProfile){setProfile(null);setMapping({});setStep(0);}else if(step===2)setStep(1);
    return sequence.current;
  }
  function source(text:string,name:string){invalidate(true);setContent(text);setFilename(name);}
  async function readFile(file?:File) {
    if(!file || !options)return;
    const token=invalidate(true);setContent('');setFilename('');
    if(!file.name.toLowerCase().endsWith('.csv') || file.size>options.max_bytes){setError('Choose a UTF-8 .csv file up to 2 MiB. Export Excel files as CSV first.');return;}
    setBusy('Reading CSV…');
    try {const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());if(token===sequence.current){setContent(text);setFilename(file.name);}}
    catch {if(token===sequence.current)setError('This file could not be decoded. Save it as CSV UTF-8 and try again.');}
    finally {if(token===sequence.current)setBusy('');}
  }
  async function run(mode:'profile'|'preview') {
    if(!options)return;
    const token=++sequence.current;request.current?.abort();const controller=new AbortController();request.current=controller;
    setBusy(mode==='profile'?'Inspecting columns…':'Checking records and references…');setError('');setResult(null);
    const timer=setTimeout(()=>controller.abort(),30000);
    try {
      const response=await fetch(api+mode,{method:'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,
        headers:{'Content-Type':'application/json','X-Frappe-CSRF-Token':options.csrf_token},body:JSON.stringify({company,kind,content,...(mode==='preview'?{mapping}:{})})});
      const data=await response.json();if(!response.ok)throw new Error(message(data,response.status));if(token!==sequence.current)return;
      if(mode==='profile'){setProfile(data.message);setMapping(data.message.mapping);setStep(1);}else{setResult(data.message);setStep(2);}
    } catch(e) {if(token===sequence.current)setError(e instanceof Error && e.name==='AbortError'?'The request timed out. Your source data is still here; try again.':e instanceof Error?e.message:'Could not connect to the ERP. Try again.');}
    finally {clearTimeout(timer);if(token===sequence.current)setBusy('');}
  }
  const missing=schema?.fields.filter(f=>f.required && !mapping[f.key]) || [];
  const unmapped=profile?.headers.filter(h=>!Object.values(mapping).includes(h)) || [];
  const fieldName=(key:string)=>schema?.fields.find(f=>f.key===key)?.label || key;
  function report(){if(!result)return;const {sample:_sample,...review}=result;download('orbit-migration-review.json',JSON.stringify({version:1,filename,kind,company,mapping,preview_only:true,...review},null,2),'application/json');}
  return <div className="migration-page">
    <a className="skip" href="#migration-main">Skip to migration</a>
    <header className="migration-top"><a className="brand draft-brand" href="/orbit"><span className="brand-mark">◒</span><span>orbit<small>COMPANY WORKSPACE</small></span></a><a className="back-link" href="/orbit">← Back to workspace</a></header>
    <div className="migration-intro"><div><div className="eyebrow">BRING YOUR BUSINESS WITH YOU</div><h1>Migration studio<span>.</span></h1><p>A clear path from your old records to your new workspace.</p></div><span className="migration-badge">PREVIEW ONLY <span aria-hidden="true">↗</span></span></div>
    <div className="migration-layout"><aside className="migration-guide"><ol aria-label="Migration steps">{['Choose your data','Map the fields','Review the results'].map((title,i)=><li key={title} aria-current={step===i?'step':undefined} className={step===i?'current':step>i?'done':''}><span>{step>i?'✓':`0${i+1}`}</span><div><strong>{title}</strong><small>{['CSV export or a sample file','Match your columns once','Resolve issues before import'][i]}</small></div></li>)}</ol><div className="migration-assurance"><span aria-hidden="true">◎</span><h2>Check first. Move with confidence.</h2><p>This preview checks your data without creating or changing ERP records.</p><p>Files stay in this tab and are sent to your ERP for validation. Closing or refreshing the tab clears your work.</p></div></aside>
      <main id="migration-main" className="migration-card" aria-busy={!!busy}>
        <div className="migration-card-heading"><div><span className="eyebrow">STEP 0{step+1} / 03</span><h2 ref={heading} tabIndex={-1}>{['Choose your source data','Give every column a home','Your data, checked'][step]}</h2></div>{profile && <span className="migration-file-count">{profile.row_count.toLocaleString()} records</span>}</div>
        {error && <div className="draft-error" role="alert"><strong>We couldn’t complete this step.</strong><p>{error}</p>{!options && <div className="migration-actions"><button className="refresh" onClick={()=>setRevision(v=>v+1)}>Retry access check</button><a href="/login?redirect-to=%2Forbit%3Fview%3Dmigration">Sign in</a></div>}</div>}
        {options && (!schema || !company) && <div className="draft-error" role="alert">No authorized record types or companies are available for migration preview.</div>}
        {step===0 && options && schema && <>
          <div className="migration-fields"><label>Record type<select value={kind} onChange={e=>{invalidate(true);setKind(e.target.value);setContent('');setFilename('');}}>{Object.entries(options.kinds).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}</select></label><label>Migration company<select value={company} onChange={e=>{invalidate(true);setCompany(e.target.value);}}>{options.companies.map(c=><option key={c.name}>{c.name}</option>)}</select></label></div>
          <div className="migration-upload"><span className="migration-upload-icon" aria-hidden="true">↥</span><h3>Start with a CSV export</h3><p>UTF-8 · Up to 2 MiB · {options.max_rows.toLocaleString()} records per file</p><label className="migration-file-label">Choose CSV file<input type="file" accept=".csv,text/csv" aria-label="Choose CSV file" onChange={e=>{void readFile(e.target.files?.[0]);e.target.value='';}}/></label>{filename && <p className="migration-filename">{filename}</p>}</div>
          <div className="migration-template"><div><strong>Need a starting point?</strong><p>Use our columns, or map your existing export.</p></div><button className="text-link" onClick={()=>download(`orbit-${kind}-template.csv`,schema.fields.map(f=>f.key).join(',')+'\n','text/csv')}>Download template ↓</button><button className="text-link" onClick={()=>source(examples[kind],`Example ${kind} (synthetic)`)}>Try an example →</button></div>
          <details className="migration-paste"><summary>Or paste CSV text</summary><label>CSV contents<textarea value={content} maxLength={options.max_bytes} spellCheck={false} onChange={e=>source(e.target.value,'Pasted CSV')} placeholder="source_id,customer_name,…"/></label></details>
          <div className="migration-action-bar"><p>Identifiers stay as text, including leading zeros.</p><button className="primary" disabled={!content || !company || !!busy} onClick={()=>void run('profile')}>Inspect columns →</button></div>
        </>}
        {step===1 && profile && schema && <>
          <p className="migration-description">Match the fields below to your CSV columns. Required fields are marked with an asterisk. Default values apply only to unmapped optional fields.</p>
          <div className="migration-mappings">{schema.fields.map(f=><div className="migration-map-row" key={f.key}><label htmlFor={'map-'+f.key}>{f.label}{f.required && <span aria-label="required"> *</span>}<small>{f.reference?`Must match a permitted ${f.reference.toLowerCase()}`:f.default!==undefined?`Default: ${f.default}`:'Preserved as text'}</small></label><span aria-hidden="true">←</span><select id={'map-'+f.key} aria-label={f.label} aria-required={f.required} value={mapping[f.key] || ''} onChange={e=>{invalidate();const next={...mapping};if(e.target.value)next[f.key]=e.target.value;else delete next[f.key];setMapping(next);}}><option value="">{f.required?'Choose a column':f.default!==undefined?`Use default (${f.default})`:'Leave blank'}</option>{profile.headers.map(h=><option key={h} value={h} disabled={Object.entries(mapping).some(([key,value])=>key!==f.key && value===h)}>{h}</option>)}</select></div>)}</div>
          {unmapped.length>0 && <div className="migration-notice"><strong>{unmapped.length} column{unmapped.length===1?'':'s'} outside this preview</strong><p>{unmapped.join(' · ')}</p><p>These columns need a mapping decision before an actual import.</p></div>}
          <details className="migration-paste"><summary>Inspect source sample · first {profile.sample.length} records</summary><div className="migration-table"><table><thead><tr>{profile.headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{profile.sample.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v || '—'}</td>)}</tr>)}</tbody></table></div></details>
          <div className="migration-action-bar"><button className="back-link" onClick={()=>{invalidate();setStep(0);}}>← Change source</button><div>{missing.length>0 && <p>Map {missing.map(f=>f.label).join(', ')} to continue.</p>}<button className="primary" disabled={missing.length>0 || !!busy} onClick={()=>void run('preview')}>Validate records →</button></div></div>
        </>}
        {step===2 && result && schema && <>
          <div className="migration-stats"><div><span>Records checked</span><strong>{result.row_count.toLocaleString()}</strong></div><div><span>Passed row checks</span><strong>{result.valid_count.toLocaleString()}</strong></div><div className={result.invalid_count?'has-issues':''}><span>Need attention</span><strong>{result.invalid_count.toLocaleString()}</strong></div></div>
          <div className={'migration-verdict '+(result.invalid_count || result.unmapped_columns.length?'attention':'clear')}><strong>{result.invalid_count?'Resolve the flagged records':result.unmapped_columns.length?'Rows checked. Column decisions remain.':'This file passed the available preview checks.'}</strong><p>No records have been imported. {result.invalid_count?'Correct the source file or mappings, then validate again.':'Rehearsal and native import validation are the next steps.'}</p></div>
          {result.unmapped_columns.length>0 && <div className="migration-notice"><strong>Unmapped columns</strong><p>{result.unmapped_columns.join(' · ')}</p></div>}
          {result.issues.length>0 && <><h3 className="migration-subtitle">What needs attention <span>{result.issue_count.toLocaleString()} issues</span></h3><p className="migration-description">Record numbers include the header; a quoted multiline value is one CSV record.</p><div className="migration-table"><table><thead><tr><th>Record</th><th>Field</th><th>How to resolve it</th></tr></thead><tbody>{result.issues.map((issue,i)=><tr key={i}><td>{issue.row}</td><td>{fieldName(issue.field)}</td><td>{issue.message}</td></tr>)}</tbody></table></div>{result.issues_truncated && <p className="migration-description">Showing the first 200 issues. Counts cover the entire file. Correct these and validate again.</p>}</>}
          <details className="migration-paste"><summary>Mapped sample · first {result.sample.length} records</summary><div className="migration-table"><table><thead><tr>{schema.fields.map(f=><th key={f.key}>{f.label}</th>)}</tr></thead><tbody>{result.sample.map(row=><tr key={row.row}>{schema.fields.map(f=><td key={f.key}>{row.values[f.key] || '—'}</td>)}</tr>)}</tbody></table></div></details>
          <div className="migration-scope"><h3>What this preview covers</h3><ul>{result.limitations.map(note=><li key={note}>{note}</li>)}</ul><p>Review ID <code>{result.fingerprint.slice(0,16)}</code> · {new Date(result.checked_at).toLocaleString()}</p></div>
          <div className="migration-action-bar"><button className="back-link" onClick={()=>{invalidate();setStep(1);}}>← Adjust mapping</button><button className="primary" onClick={report}>Download review ↓</button></div>
        </>}
        {busy && <p className="migration-progress" role="status">{busy}</p>}
      </main>
    </div><footer className="migration-footer">YOUR DATA. A TRACEABLE START.<span>Preview → Rehearse → Reconcile → Import</span></footer>
  </div>;
}
