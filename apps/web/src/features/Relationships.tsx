import { useState } from "react";
import { api } from "../api";
import { Field, Modal, Notice, Pager, short, useData } from "../components";
import { pesos, phDateTime } from "../locale";
import type { PartyKind } from "../PartyPicker";
export function Relationships({
  kind,
  role,
}: {
  kind: PartyKind;
  role: string;
}) {
  const [q, setQ] = useState(""),
    [active, setActive] = useState("true"),
    [page, setPage] = useState(1),
    [v, setV] = useState(0),
    [edit, setEdit] = useState<any>(null),
    [selected, setSelected] = useState("");
  const { data, error } = useData(
    "/parties/" +
      kind +
      "?" +
      new URLSearchParams({ q, active, page: String(page) }),
    v,
  );
  const canCreate = role === "manager" || kind === "customers";
  return (
    <>
      <div className="toolbar">
        <Field label={"Search " + kind}>
          <input
            value={q}
            placeholder="Name, phone, email or contact"
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field label="Account status">
          <select
            value={active}
            onChange={(e) => {
              setActive(e.target.value);
              setPage(1);
            }}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
            <option value="all">All accounts</option>
          </select>
        </Field>
        {canCreate && (
          <button className="primary" onClick={() => setEdit({})}>
            + New {kind === "customers" ? "customer" : "supplier"}
          </button>
        )}
      </div>
      <Notice>{error}</Notice>
      <section className="panel">
        <div className="panel-title">
          <h2>
            {kind === "customers" ? "Customer directory" : "Supplier directory"}
          </h2>
          <span className="muted">
            {data ? data.total + " matching accounts" : "Loading…"}
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Status</th>
                <th>Record</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => setSelected(p.id)}
                    >
                      {p.name}
                    </button>
                    <small>
                      {p.party_type === "company" ? "Company" : "Individual"} ·{" "}
                      {short(p.id)}
                    </small>
                  </td>
                  <td>
                    {p.contact_name || "—"}
                    <small>{p.phone || p.email || "No contact details"}</small>
                  </td>
                  <td>
                    {[p.address?.city, p.address?.province]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  <td>
                    <span className={"badge " + (p.active ? "" : "neutral")}>
                      {p.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => setSelected(p.id)}>View</button>
                    {role === "manager" && (
                      <button className="quiet" onClick={() => setEdit(p)}>
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.total === 0 && (
          <div className="empty">No accounts match these filters.</div>
        )}
        <Pager page={page} onPage={setPage} count={data?.items.length} />
      </section>
      {edit && (
        <ProfileForm
          kind={kind}
          profile={edit}
          role={role}
          close={() => setEdit(null)}
          saved={() => {
            setEdit(null);
            setV(v + 1);
          }}
        />
      )}
      {selected && (
        <ProfileView kind={kind} id={selected} close={() => setSelected("")} />
      )}
    </>
  );
}
function ProfileForm({
  kind,
  profile: p,
  role,
  close,
  saved,
}: {
  kind: PartyKind;
  profile: any;
  role: string;
  close: () => void;
  saved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title={
        (p.id ? "Edit " : "New ") +
        (kind === "customers" ? "customer" : "supplier")
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
          const payload = {
            name: f.name,
            phone: f.phone,
            email: f.email,
            contactName: f.contactName,
            partyType: f.partyType,
            address: Object.fromEntries(
              ["street", "barangay", "city", "province", "postalCode"].map(
                (k) => [k, f[k] ?? ""],
              ),
            ),
            ...(role === "manager"
              ? {
                  tin: f.tin,
                  termsDays: Number(f.termsDays),
                  creditLimit: f.creditLimit,
                  notes: f.notes,
                  active: f.active === "true",
                }
              : {}),
            ...(p.id ? { version: p.version } : {}),
          };
          try {
            await api(
              "/parties/" + kind + (p.id ? "/" + p.id : ""),
              p.id ? "PUT" : "POST",
              payload,
            );
            saved();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <h3>Account details</h3>
          <div className="form-grid">
            <Field label="Account name">
              <input
                name="name"
                required
                maxLength={200}
                defaultValue={p.name || ""}
              />
            </Field>
            <Field label="Type">
              <select name="partyType" defaultValue={p.party_type || "company"}>
                <option value="company">Company</option>
                <option value="individual">Individual</option>
              </select>
            </Field>
            <Field label="Contact person">
              <input
                name="contactName"
                maxLength={200}
                defaultValue={p.contact_name || ""}
              />
            </Field>
            <Field label="Phone">
              <input
                name="phone"
                type="tel"
                maxLength={200}
                defaultValue={p.phone || ""}
              />
            </Field>
            <Field label="Email">
              <input
                name="email"
                type="email"
                maxLength={200}
                defaultValue={p.email || ""}
              />
            </Field>
          </div>
          <h3>Philippine address</h3>
          <div className="form-grid">
            {[
              ["street", "Street / building"],
              ["barangay", "Barangay"],
              ["city", "City / municipality"],
              ["province", "Province"],
              ["postalCode", "Postal code"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  name={key}
                  maxLength={key === "postalCode" ? 20 : 200}
                  defaultValue={p.address?.[key] || ""}
                />
              </Field>
            ))}
          </div>
          {role === "manager" && (
            <>
              <h3>Account controls</h3>
              <div className="form-grid">
                <Field label="TIN (optional, managers only)">
                  <input name="tin" maxLength={80} defaultValue={p.tin || ""} />
                </Field>
                <Field label="Payment terms (days)">
                  <input
                    name="termsDays"
                    type="number"
                    min={0}
                    max={365}
                    required
                    defaultValue={p.terms_days ?? 0}
                  />
                </Field>
                <Field label="Credit limit (₱)">
                  <input
                    name="creditLimit"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    defaultValue={p.credit_limit ?? "0.00"}
                  />
                </Field>
                <Field label="Status">
                  <select name="active" defaultValue={String(p.active ?? true)}>
                    <option value="true">Active</option>
                    <option value="false">
                      Inactive — block new transactions
                    </option>
                  </select>
                </Field>
              </div>
              <p className="hint">
                Terms and limits are recorded for account setup. Credit sales
                and receivables are not yet enabled.
              </p>
              <Field label="Private account notes">
                <textarea
                  name="notes"
                  maxLength={2000}
                  defaultValue={p.notes || ""}
                />
              </Field>
            </>
          )}
          <Notice>{error}</Notice>
          <div className="modal-actions">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button className="primary">
              {busy ? "Saving…" : "Save account"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
function ProfileView({
  kind,
  id,
  close,
}: {
  kind: PartyKind;
  id: string;
  close: () => void;
}) {
  const [page, setPage] = useState(1),
    [doc, setDoc] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const result = useData("/parties/" + kind + "/" + id + "?page=" + page);
  const p = result.data?.profile,
    history = result.data?.history;
  return (
    <Modal title={p?.name || "Account record"} onClose={close}>
      <Notice>{result.error || error}</Notice>
      {p && (
        <>
          <div className="record-summary">
            <span className="badge">{p.active ? "Active" : "Inactive"}</span>
            <p>
              {p.contact_name} {p.phone}
              <br />
              {p.email}
            </p>
            <p>
              {Object.values(p.address).filter(Boolean).join(", ") ||
                "No address saved"}
            </p>
            {p.tin && <p>TIN: {p.tin}</p>}
            {p.credit_limit !== undefined && (
              <p>
                Terms: {p.terms_days} days · Recorded limit:{" "}
                {pesos(p.credit_limit)}
              </p>
            )}
            {p.notes && <p>{p.notes}</p>}
          </div>
          <h3>
            {kind === "customers"
              ? "Sales and saved drafts"
              : "Purchase orders"}
          </h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {history.items.map((h: any) => (
                  <tr key={h.id}>
                    <td>
                      <button
                        disabled={loading}
                        className="text-button"
                        onClick={async () => {
                          setLoading(true);
                          setError("");
                          try {
                            const r = await api(
                              kind === "customers"
                                ? "/sales/" + h.id
                                : "/purchases?q=" + h.id + "&limit=1",
                            );
                            setDoc(
                              kind === "customers"
                                ? r
                                : r.find((o: any) => o.id === h.id),
                            );
                          } catch (e: any) {
                            setError(e.message);
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        {short(h.id)}
                      </button>
                    </td>
                    <td>{phDateTime(h.created_at)}</td>
                    <td>{h.status}</td>
                    <td>
                      {h.total !== undefined && h.total !== null
                        ? pesos(h.total)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!history.total && (
            <p className="empty">No transactions visible for this account.</p>
          )}
          <Pager page={page} onPage={setPage} count={history.items.length} />
          {doc && (
            <section className="record-summary">
              <h3>
                {short(doc.id)} · {doc.status}
              </h3>
              {doc.lines.map((l: any) => (
                <p key={l.partId || l.part_id}>
                  {l.sku} · {l.name} · {l.qty} units{" "}
                  {l.price !== undefined
                    ? " · " + pesos(l.price) + " each"
                    : l.cost !== undefined
                      ? " · " + pesos(l.cost) + " each"
                      : ""}
                </p>
              ))}
              {doc.total !== undefined && <p>Total: {pesos(doc.total)}</p>}
              <button onClick={() => setDoc(null)}>
                Close transaction detail
              </button>
            </section>
          )}
        </>
      )}
    </Modal>
  );
}
