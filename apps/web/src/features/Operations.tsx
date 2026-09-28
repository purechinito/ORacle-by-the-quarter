import { usePosting } from "../usePosting";
import { Receipt } from "./Counter";
import { ImportDialog } from "./Catalog";
import { useState } from "react";
import { api } from "../api";
import {
  Pager,
  HistoryFilters,
  emptyFilters,
  historyParams,
  Field,
  Modal,
  Notice,
  PartPicker,
  short,
  useData,
  type Part,
} from "../components";
export function Stock({ role }: { role: string }) {
  const [v, setV] = useState(0),
    [open, setOpen] = useState(false),
    [imp, setImp] = useState(false),
    [page, setPage] = useState(1),
    [filters, setFilters] = useState(emptyFilters);
  const { data, error } = useData(
    "/movements?" +
      historyParams({ ...filters, status: "" }, page) +
      "&kind=" +
      filters.status,
    v,
  );
  return (
    <>
      <div className="toolbar">
        <p className="muted">
          Main stockroom · posted movements are permanent records
        </p>
        {role === "manager" && (
          <div className="row-actions">
            <button onClick={() => setImp(true)}>Import opening stock</button>
            <button className="primary" onClick={() => setOpen(true)}>
              + Record stock change
            </button>
          </div>
        )}
      </div>
      <HistoryFilters
        value={filters}
        statuses={["opening", "adjustment", "receipt", "sale", "return"]}
        onChange={(f) => {
          setFilters(f);
          setPage(1);
        }}
      />
      <Notice>{error}</Notice>
      <section className="panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>When / Who</th>
                <th>Part</th>
                <th>Movement</th>
                <th>Quantity</th>
                <th>Reason / Reference</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((m: any) => (
                <tr key={m.id}>
                  <td>
                    {new Date(m.created_at).toLocaleString()}
                    <small>{m.username}</small>
                  </td>
                  <td>
                    <b>{m.name}</b>
                    <small>{m.sku}</small>
                  </td>
                  <td>
                    <span className="badge neutral">{m.kind}</span>
                  </td>
                  <td className={m.qty > 0 ? "positive" : "negative"}>
                    {m.qty > 0 ? "+" : ""}
                    {m.qty}
                  </td>
                  <td>
                    {m.reason}
                    <small className="mono">{short(m.document_id)}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.length === 0 && (
          <div className="empty">No stock movements recorded.</div>
        )}
        <Pager page={page} onPage={setPage} count={data?.length} />
      </section>
      {imp && (
        <ImportDialog
          stock
          close={() => setImp(false)}
          saved={() => {
            setImp(false);
            setV(v + 1);
          }}
        />
      )}
      {open && (
        <StockForm
          close={() => setOpen(false)}
          saved={() => {
            setOpen(false);
            setV(v + 1);
          }}
        />
      )}
    </>
  );
}
function StockForm({ close, saved }: { close: () => void; saved: () => void }) {
  const posting = usePosting("stock");
  const [part, setPart] = useState<Part | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [key] = useState(crypto.randomUUID());
  return (
    <Modal title="Record stock change" onClose={close} canClose={!busy}>
      <fieldset disabled={busy || posting.pending}>
        <PartPicker
          onPick={setPart}
          disabled={busy || posting.pending}
          includeInactive
        />
      </fieldset>
      {part && (
        <p>
          <b>{part.name}</b> · {part.stock} currently on hand
        </p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            await posting.submit("/stock", {
              key,
              kind: f.get("kind"),
              reason: f.get("reason"),
              lines: [{ partId: part?.id, qty: Number(f.get("qty")) }],
            });
            saved();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {posting.pending && (
          <Notice>
            A stock change is awaiting confirmation. Retry recovers the original
            submitted change.
          </Notice>
        )}
        <fieldset disabled={busy || posting.pending}>
          <div className="form-grid">
            <Field label="Movement type">
              <select name="kind">
                <option value="adjustment">Count adjustment</option>
                <option value="opening">Opening stock (once per part)</option>
              </select>
            </Field>
            <Field label="Quantity change (+ add / − remove)">
              <input name="qty" type="number" step="1" required />
            </Field>
          </div>
          <Field label="Reason">
            <input
              name="reason"
              required
              placeholder="e.g. Physical count correction"
            />
          </Field>
          <p className="hint">
            This posts immediately. Use a new adjustment to correct an error;
            history remains intact.
          </p>
        </fieldset>
        <Notice>{error}</Notice>
        <div className="form-actions">
          <button type="button" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={busy || (!part && !posting.pending)}
          >
            {posting.pending ? "Retry original change" : "Post stock change"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function Settings() {
  const [v, setV] = useState(0),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const { data, error } = useData("/settings", v),
    { data: users } = useData("/users", v);
  return (
    <>
      <Notice>{error || message}</Notice>
      <div className="settings-grid">
        <section className="panel pad">
          <h2>Shop configuration</h2>
          <p className="muted">Configure these before posting sales.</p>
          {data && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setMessage("");
                try {
                  await api(
                    "/settings",
                    "POST",
                    Object.fromEntries(new FormData(e.currentTarget)),
                  );
                  setMessage("Shop settings saved.");
                  setV(v + 1);
                } catch (e: any) {
                  setMessage(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Shop name">
                <input
                  name="shopName"
                  required
                  defaultValue={data.shopName ?? ""}
                />
              </Field>
              <div className="form-grid">
                <Field label="Currency (two decimal places)">
                  <input
                    name="currency"
                    required
                    pattern="[A-Z]{3}"
                    placeholder="e.g. USD"
                    defaultValue={data.currency ?? ""}
                  />
                </Field>
                <Field label="Business timezone">
                  <input
                    name="timezone"
                    required
                    placeholder="e.g. Asia/Manila"
                    defaultValue={data.timezone ?? ""}
                  />
                </Field>
              </div>
              <div className="form-grid">
                <Field label="Tax treatment">
                  <select name="taxMode" defaultValue={data.taxMode ?? "none"}>
                    <option value="none">No tax</option>
                    <option value="inclusive">Price includes tax</option>
                    <option value="exclusive">Tax added to price</option>
                  </select>
                </Field>
                <Field label="Tax rate (%)">
                  <input
                    name="taxRate"
                    min="0"
                    max="100"
                    step=".01"
                    type="number"
                    defaultValue={data.taxRate ?? "0"}
                  />
                </Field>
              </div>
              <button disabled={busy} className="primary">
                Save configuration
              </button>
              <p className="hint">
                Confirm local receipt and tax requirements before live trading.
              </p>
            </form>
          )}
        </section>
        <section className="panel pad">
          <h2>Staff accounts</h2>
          <div className="staff-list">
            {users?.map((u: any) => (
              <div key={u.id}>
                <span className="avatar">{u.username[0].toUpperCase()}</span>
                <b>{u.username}</b>
                <span className="badge neutral">{u.role}</span>
              </div>
            ))}
          </div>
          <h3>Add a staff account</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              setBusy(true);
              try {
                await api(
                  "/users",
                  "POST",
                  Object.fromEntries(new FormData(form)),
                );
                form.reset();
                setV(v + 1);
                setMessage("Staff account created.");
              } catch (e: any) {
                setMessage(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Username">
              <input name="username" required minLength={2} />
            </Field>
            <Field label="Password (at least 12 characters)">
              <input
                name="password"
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Role">
              <select name="role">
                <option value="counter">Counter staff</option>
                <option value="stock">Stock clerk</option>
                <option value="manager">Manager</option>
              </select>
            </Field>
            <button disabled={busy}>Create account</button>
          </form>
        </section>
      </div>
    </>
  );
}
export function Reports({ role }: { role: string }) {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [page, setPage] = useState(1),
    [receipt, setReceipt] = useState<any>(null),
    [message, setMessage] = useState("");
  const { data: d, error } = useData(
    "/reports?" +
      new URLSearchParams({
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        page: String(page),
      }),
  );
  return (
    <>
      <div className="toolbar">
        <Field label="From date">
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field label="Through date">
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        {role === "manager" && (
          <a className="button" href="/api/reports/export">
            Export current stock CSV ↓
          </a>
        )}
      </div>
      <Notice>{error || message}</Notice>
      {receipt && (
        <Receipt
          sale={receipt}
          role={role}
          close={() => setReceipt(null)}
          returned={() => setReceipt(null)}
        />
      )}
      {d && (
        <>
          <p className="muted">
            {d.location} · {d.timezone} ·{" "}
            {d.currency || "Currency not configured"} · {from || "All dates"}{" "}
            through {to || "today"}
          </p>
          <div className="stat-grid">
            {[
              ["Sales recorded", d.salesTotal],
              ["Payments recorded", d.paymentTotal],
              ["Posted sales", d.salesCount],
              ["Return records", d.returns],
            ].map(([label, value]) => (
              <article key={label} className="stat">
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <section className="panel">
            <div className="panel-title">
              <h2>Supporting sales</h2>
              <span className="muted">{d.salesCount} sales in date range</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Posted</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {d.recent.map((s: any) => (
                  <tr key={s.id}>
                    <td className="mono">
                      {role === "manager" ? (
                        <button
                          className="row-link"
                          onClick={async () => {
                            try {
                              setReceipt(await api("/sales/" + s.id));
                            } catch (e: any) {
                              setMessage(e.message);
                            }
                          }}
                        >
                          {short(s.id)}
                        </button>
                      ) : (
                        short(s.id)
                      )}
                    </td>
                    <td>{new Date(s.posted_at).toLocaleString()}</td>
                    <td>
                      {d.currency} {s.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={page} onPage={setPage} count={d.recent.length} />
            <p className="hint pad">
              Sales and payments are gross recorded totals. Returns and external
              refunds are tracked separately; these figures are not profit or
              net revenue.
            </p>
          </section>
        </>
      )}
    </>
  );
}

export function Audit() {
  const [filters, setFilters] = useState(emptyFilters),
    [page, setPage] = useState(1);
  const { data, error } = useData("/audit?" + historyParams(filters, page));
  return (
    <>
      <HistoryFilters
        value={filters}
        onChange={(f) => {
          setFilters(f);
          setPage(1);
        }}
      />
      <Notice>{error}</Notice>
      <section className="panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Staff member</th>
                <th>Action / reason</th>
                <th>Record reference</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((a: any) => (
                <tr key={a.id}>
                  <td>{new Date(a.created_at).toLocaleString()}</td>
                  <td>{a.username}</td>
                  <td>{a.action}</td>
                  <td className="mono">{a.record_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.length === 0 && (
          <div className="empty">No activity matches these filters.</div>
        )}
        <Pager page={page} onPage={setPage} count={data?.length} />
      </section>
    </>
  );
}
