import { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { api } from "../api";
import { Field, Modal, Notice, Pager, short, useData } from "../components";
import { pesos } from "../locale";
import { usePosting } from "../usePosting";
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const basis =
  "Manual journals only. Sales, purchases and stock do not yet post into these books.";
export function Finance({
  onBusyChange,
}: {
  onBusyChange: (v: boolean) => void;
}) {
  const [tab, setTab] = useState("Journals"),
    [v, setV] = useState(0),
    [page, setPage] = useState(1),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [modal, setModal] = useState<any>(null),
    [busy, setLocalBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const posting = usePosting("finance-action"),
    saving = usePosting("finance-save");
  const setBusy = (value: boolean) => {
    setLocalBusy(value);
    onBusyChange(value);
  };
  useEffect(() => () => onBusyChange(false), [onBusyChange]);
  const { data: accounts, error: accountsError } = useData(
      "/finance/accounts",
      v,
    ),
    { data: periods, error: periodsError } = useData("/finance/periods", v),
    { data: journals, error: journalError } = useData(
      "/finance/journals?" +
        new URLSearchParams({ page: String(page), q, status }),
      v,
    );
  const pending = posting.pending || saving.pending;
  const retained = saving.pendingAction || posting.pendingAction;
  function refresh() {
    setV((n) => n + 1);
    setModal(null);
  }
  async function submit(path: string, body: any, save = false) {
    setBusy(true);
    setError("");
    try {
      const result = await (save ? saving : posting).submit(path, body);
      setMessage(
        "Journal " +
          short(result.id) +
          " " +
          (result.status === "posted" ? "posted." : "saved."),
      );
      refresh();
      return result;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function openJournal(id: string) {
    setBusy(true);
    setError("");
    try {
      setModal({
        type: "journal",
        record: await api("/finance/journals/" + id),
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="finance-basis">
        <b>PHP ledger</b>
        <span>{basis}</span>
      </div>
      <Notice>
        {error || accountsError || periodsError || journalError || message}
      </Notice>
      {pending && (
        <section className="notice">
          <p>
            A previous journal action has an uncertain result. Recover it before
            starting another action.
          </p>
          {retained && (
            <p>
              Saved request:{" "}
              {retained.path.endsWith("/reverse")
                ? "Reverse journal " + short(retained.path.split("/")[3])
                : retained.path.endsWith("/post")
                  ? "Post journal " + short(retained.path.split("/")[3])
                  : "Save journal draft"}
              {retained.body.date && " · " + retained.body.date}
              {(retained.body.reason || retained.body.memo) &&
                " · " + (retained.body.reason || retained.body.memo)}
            </p>
          )}
          <button
            disabled={busy}
            onClick={() => void submit("", {}, saving.pending).catch(() => {})}
          >
            Recover previous action
          </button>
        </section>
      )}
      <div
        className="finance-tabs"
        role="tablist"
        aria-label="Finance sections"
      >
        {["Journals", "Chart of accounts", "Periods", "Trial balance"].map(
          (name) => (
            <button
              key={name}
              role="tab"
              aria-selected={tab === name}
              className={tab === name ? "active" : ""}
              disabled={busy}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ),
        )}
      </div>
      {tab === "Journals" && (
        <>
          <div className="toolbar">
            <Field label="Search journals">
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Memo or reference"
              />
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All journals</option>
                <option value="draft">Drafts</option>
                <option value="posted">Posted</option>
              </select>
            </Field>
            <button
              className="primary"
              disabled={
                busy || pending || !accounts?.some((a: any) => a.active)
              }
              onClick={() => setModal({ type: "journal", record: {} })}
            >
              + New journal
            </button>
          </div>
          {accounts?.length === 0 && (
            <div className="empty">
              Start by adding your chart of accounts and an accounting period.
            </div>
          )}
          <section className="panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date / reference</th>
                    <th>Memo</th>
                    <th>Debits (₱)</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {journals?.items.map((j: any) => (
                    <tr key={j.id}>
                      <td>
                        {j.journal_date}
                        <small>{short(j.id)}</small>
                      </td>
                      <td>
                        {j.memo}
                        {j.reverses_id && (
                          <small>Reverses {short(j.reverses_id)}</small>
                        )}
                        {j.reversal_id && (
                          <small>Reversed by {short(j.reversal_id)}</small>
                        )}
                      </td>
                      <td>{pesos(j.total)}</td>
                      <td>
                        <span
                          className={
                            "badge " + (j.status === "draft" ? "neutral" : "")
                          }
                        >
                          {j.status}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            disabled={busy || pending}
                            onClick={() => openJournal(j.id)}
                          >
                            {j.status === "draft" ? "Edit" : "View"}
                          </button>
                          {j.status === "draft" ? (
                            <button
                              disabled={busy || pending}
                              onClick={() => {
                                if (
                                  confirm(
                                    "Post this journal? Posted lines are locked; corrections require a reversal.",
                                  )
                                )
                                  void submit(
                                    "/finance/journals/" + j.id + "/post",
                                    { key: crypto.randomUUID() },
                                  ).catch(() => {});
                              }}
                            >
                              Post
                            </button>
                          ) : (
                            !j.reverses_id &&
                            !j.reversal_id && (
                              <button
                                disabled={busy || pending}
                                onClick={() =>
                                  setModal({ type: "reverse", record: j })
                                }
                              >
                                Reverse
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {journals?.total === 0 && (
              <div className="empty">No journals match this view.</div>
            )}
            <Pager
              page={page}
              onPage={setPage}
              count={journals?.items.length}
            />
          </section>
        </>
      )}
      {tab === "Chart of accounts" && (
        <section className="panel">
          <div className="panel-title">
            <h2>Chart of accounts</h2>
            <button
              className="primary"
              disabled={busy || pending}
              onClick={() => setModal({ type: "account" })}
            >
              + Add account
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Classification</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {accounts?.map((a: any) => (
                  <tr key={a.id}>
                    <td className="mono">{a.code}</td>
                    <td>{a.name}</td>
                    <td>{a.type}</td>
                    <td>{a.active ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {accounts?.length === 0 && (
            <p className="empty">
              Add the accounts your bookkeeper uses. No opening balances are
              assumed.
            </p>
          )}
        </section>
      )}
      {tab === "Periods" && (
        <section className="panel">
          <div className="panel-title">
            <h2>Accounting periods</h2>
            <button
              className="primary"
              disabled={busy || pending}
              onClick={() => setModal({ type: "period" })}
            >
              + Add period
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Dates</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {periods?.map((p: any) => (
                  <tr key={p.id}>
                    <td>
                      {p.name}
                      <small>{p.reason}</small>
                    </td>
                    <td>
                      {p.starts_on} – {p.ends_on}
                    </td>
                    <td>
                      <span className="badge neutral">{p.status}</span>
                    </td>
                    <td>
                      <button
                        disabled={busy || pending}
                        onClick={() =>
                          setModal({
                            type: p.status === "open" ? "close" : "reopen",
                            record: p,
                          })
                        }
                      >
                        {p.status === "open" ? "Close period" : "Reopen period"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {periods?.length === 0 && (
            <p className="empty">
              Create non-overlapping periods before posting. Dates use the
              Philippine business calendar.
            </p>
          )}
        </section>
      )}
      {tab === "Trial balance" && <TrialBalance version={v} />}
      {modal?.type === "journal" && (
        <JournalForm
          record={modal.record}
          accounts={accounts || []}
          close={() => setModal(null)}
          submit={(body) => submit("/finance/journals", body, true)}
          blocked={pending}
        />
      )}
      {modal && modal.type !== "journal" && (
        <FinanceAction
          action={modal}
          close={() => setModal(null)}
          saved={refresh}
          setBusy={setBusy}
          reverse={(p, b) => submit(p, b)}
          blocked={pending}
        />
      )}
    </>
  );
}
function JournalForm({
  record,
  accounts,
  close,
  submit,
  blocked,
}: {
  record: any;
  accounts: any[];
  close: () => void;
  submit: (body: any) => Promise<any>;
  blocked: boolean;
}) {
  const initial = record.lines?.map((l: any) => ({
    accountId: l.account_id,
    description: l.description,
    debit: l.debit,
    credit: l.credit,
  })) ?? [
    { accountId: "", description: "", debit: "", credit: "" },
    { accountId: "", description: "", debit: "", credit: "" },
  ];
  const [lines, setLines] = useState<any[]>(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const locked = record.status === "posted";
  const dr = lines.reduce((n, l) => n.add(l.debit || 0), new Decimal(0)),
    cr = lines.reduce((n, l) => n.add(l.credit || 0), new Decimal(0));
  const update = (i: number, k: string, val: string) =>
    setLines((ls) => ls.map((l, n) => (n === i ? { ...l, [k]: val } : l)));
  return (
    <Modal
      title={
        record.id
          ? (locked ? "Posted journal " : "Edit journal ") + short(record.id)
          : "New journal"
      }
      onClose={close}
      canClose={!busy}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = Object.fromEntries(new FormData(e.currentTarget));
          try {
            await submit({
              ...(record.id ? { id: record.id, version: record.version } : {}),
              key: crypto.randomUUID(),
              date: f.date,
              memo: f.memo,
              currency: "PHP",
              lines: lines.map((l) => ({
                ...l,
                debit: l.debit || "0",
                credit: l.credit || "0",
              })),
            });
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy || locked || blocked}>
          <div className="form-grid">
            <Field label="Business date">
              <input
                name="date"
                type="date"
                required
                defaultValue={record.journal_date || today()}
              />
            </Field>
            <Field label="Memo">
              <input
                name="memo"
                required
                maxLength={200}
                defaultValue={record.memo || ""}
              />
            </Field>
          </div>
          <div className="journal-lines">
            {lines.map((l, i) => (
              <div className="journal-line" key={i}>
                <Field label={"Account · line " + (i + 1)}>
                  <select
                    required
                    value={l.accountId}
                    onChange={(e) => update(i, "accountId", e.target.value)}
                  >
                    <option value="">Choose account</option>
                    {accounts
                      .filter((a) => a.active || a.id === l.accountId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} · {a.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Description">
                  <input
                    value={l.description}
                    maxLength={300}
                    onChange={(e) => update(i, "description", e.target.value)}
                  />
                </Field>
                <Field label="Debit (₱)">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.debit}
                    onChange={(e) => update(i, "debit", e.target.value)}
                  />
                </Field>
                <Field label="Credit (₱)">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.credit}
                    onChange={(e) => update(i, "credit", e.target.value)}
                  />
                </Field>
                {!locked && (
                  <button
                    aria-label={"Remove line " + (i + 1)}
                    type="button"
                    disabled={lines.length <= 2}
                    onClick={() =>
                      setLines((ls) => ls.filter((_, n) => n !== i))
                    }
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {!locked && (
            <button
              type="button"
              disabled={lines.length >= 500}
              onClick={() =>
                setLines([
                  ...lines,
                  { accountId: "", description: "", debit: "", credit: "" },
                ])
              }
            >
              + Add line
            </button>
          )}
          <div className="journal-totals">
            <span>
              Debits <b>{pesos(dr.toFixed(2))}</b>
            </span>
            <span>
              Credits <b>{pesos(cr.toFixed(2))}</b>
            </span>
            <span>
              Difference <b>{pesos(dr.sub(cr).toFixed(2))}</b>
            </span>
          </div>
          <Notice>{error}</Notice>
          {!locked && (
            <button className="primary">
              {busy ? "Saving…" : "Save draft"}
            </button>
          )}
        </fieldset>
        {locked && (
          <p className="hint">
            Posted lines are immutable. Use the journal’s Reverse action for a
            correction.
          </p>
        )}
        {blocked && (
          <Notice>
            Save result uncertain. Use “Recover previous action” on the Finance
            page before editing.
          </Notice>
        )}
      </form>
    </Modal>
  );
}
function FinanceAction({
  action,
  close,
  saved,
  setBusy,
  reverse,
  blocked,
}: {
  action: any;
  close: () => void;
  saved: () => void;
  setBusy: (v: boolean) => void;
  reverse: (p: string, b: any) => Promise<any>;
  blocked: boolean;
}) {
  const [working, setWorking] = useState(false),
    [error, setError] = useState("");
  const type = action.type,
    p = action.record;
  const names: any = {
    account: "Add account",
    period: "Add accounting period",
    close: "Close accounting period",
    reopen: "Reopen accounting period",
    reverse: "Reverse posted journal",
  };
  return (
    <Modal title={names[type]} onClose={close} canClose={!working}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setWorking(true);
          setBusy(true);
          setError("");
          const f = Object.fromEntries(new FormData(e.currentTarget));
          try {
            if (type === "account") await api("/finance/accounts", "POST", f);
            else if (type === "period")
              await api("/finance/periods", "POST", f);
            else if (type === "reverse")
              await reverse("/finance/journals/" + p.id + "/reverse", {
                ...f,
                key: crypto.randomUUID(),
              });
            else await api("/finance/periods/" + p.id + "/" + type, "POST", f);
            saved();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setWorking(false);
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={working || blocked}>
          {type === "account" ? (
            <>
              <Field label="Account code">
                <input
                  name="code"
                  required
                  maxLength={20}
                  pattern="[A-Za-z0-9-]+"
                />
              </Field>
              <Field label="Account name">
                <input name="name" required maxLength={200} />
              </Field>
              <Field label="Classification">
                <select name="type">
                  {["asset", "liability", "equity", "income", "expense"].map(
                    (k) => (
                      <option key={k}>{k}</option>
                    ),
                  )}
                </select>
              </Field>
            </>
          ) : type === "period" ? (
            <>
              <Field label="Period name">
                <input name="name" required maxLength={200} />
              </Field>
              <div className="form-grid">
                <Field label="From date">
                  <input name="from" type="date" required />
                </Field>
                <Field label="Through date">
                  <input name="to" type="date" required />
                </Field>
              </div>
            </>
          ) : (
            <>
              <p>{p.name || p.memo}</p>
              {type === "reverse" && (
                <Field label="Reversal business date">
                  <input
                    name="date"
                    type="date"
                    min={p.journal_date}
                    required
                    defaultValue={today()}
                  />
                </Field>
              )}
              <Field label="Reason">
                <input name="reason" required maxLength={200} />
              </Field>
              <p className="hint">
                {type === "close"
                  ? "Closing blocks new journals in this period. Review your entries first."
                  : type === "reopen"
                    ? "Reopening permits new postings and is recorded in the activity log."
                    : "A separate journal will reverse the original amounts, preserving both records."}
              </p>
            </>
          )}
          <Notice>{error}</Notice>
          <div className="modal-actions">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button className="primary">
              {working ? "Saving…" : names[type]}
            </button>
          </div>
        </fieldset>
        {blocked && (
          <Notice>
            Reversal result uncertain. The original date and reason are
            retained. Close this window and use “Recover previous action” on the
            Finance page.
          </Notice>
        )}
      </form>
    </Modal>
  );
}
function TrialBalance({ version }: { version: number }) {
  const [from, setFrom] = useState(today().slice(0, 4) + "-01-01"),
    [to, setTo] = useState(today()),
    [account, setAccount] = useState<any>(null),
    [page, setPage] = useState(1);
  const { data, error } = useData(
    "/finance/trial-balance?" + new URLSearchParams({ from, to }),
    version,
  );
  const columns = [
    "openingDebit",
    "openingCredit",
    "debit",
    "credit",
    "closingDebit",
    "closingCredit",
  ];
  return (
    <>
      <div className="toolbar">
        <Field label="From date">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="Through date">
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
      </div>
      <Notice>{error}</Notice>
      <section className="panel">
        <div className="panel-title">
          <h2>Trial balance</h2>
          <span className="muted">
            Philippine pesos · posted manual journals
          </span>
        </div>
        <div className="table-scroll">
          <table className="financial-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Opening Dr</th>
                <th>Opening Cr</th>
                <th>Movement Dr</th>
                <th>Movement Cr</th>
                <th>Closing Dr</th>
                <th>Closing Cr</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((r: any) => (
                <tr key={r.id}>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => {
                        setAccount(r);
                        setPage(1);
                      }}
                    >
                      {r.code} · {r.name}
                    </button>
                  </td>
                  {columns.map((k) => (
                    <td key={k}>{pesos(r[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            {data && (
              <tfoot>
                <tr>
                  <th>Total</th>
                  {columns.map((k) => (
                    <th key={k}>{pesos(data.totals[k])}</th>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {data?.items.length === 0 && (
          <p className="empty">
            Add accounts and post a balanced journal to start your ledger.
          </p>
        )}
      </section>
      {account && (
        <Modal
          title={account.code + " · " + account.name + " — ledger"}
          onClose={() => setAccount(null)}
        >
          <Ledger
            accountId={account.id}
            from={from}
            to={to}
            page={page}
            onPage={setPage}
          />
        </Modal>
      )}
    </>
  );
}
function Ledger({
  accountId,
  from,
  to,
  page,
  onPage,
}: {
  accountId: string;
  from: string;
  to: string;
  page: number;
  onPage: (n: number) => void;
}) {
  const { data, error } = useData(
    "/finance/ledger?" +
      new URLSearchParams({ accountId, from, to, page: String(page) }),
  );
  return (
    <>
      <Notice>{error}</Notice>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date / journal</th>
              <th>Memo</th>
              <th>Debit</th>
              <th>Credit</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((l: any) => (
              <tr key={l.id + ":" + l.line_no}>
                <td>
                  {l.journal_date}
                  <small>{short(l.id)}</small>
                </td>
                <td>
                  {l.memo}
                  <small>{l.description}</small>
                </td>
                <td>{pesos(l.debit)}</td>
                <td>{pesos(l.credit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data?.total === 0 && (
        <p className="empty">No posted movements for these dates.</p>
      )}
      <Pager page={page} onPage={onPage} count={data?.items.length} />
    </>
  );
}
