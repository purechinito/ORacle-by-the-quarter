import { usePosting } from "../usePosting";
import { addPartToCart, invalidateCartTotals } from "../cart";
import { createCheckout } from "../checkout";
import { useRef, useState } from "react";
import { api } from "../api";
import {
  Field,
  Modal,
  Notice,
  PartPicker,
  short,
  useData,
  type Part,
} from "../components";
export function Counter({ role }: { role: string }) {
  const checkout = useRef(createCheckout(api));
  const [cart, setCart] = useState<any>(null),
    [lines, setLines] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [v, setV] = useState(0),
    [receipt, setReceipt] = useState<any>(null),
    [key, setKey] = useState(crypto.randomUUID()),
    [payment, setPayment] = useState(""),
    [customer, setCustomer] = useState("");
  const { data: sales } = useData("/sales", v),
    { data: customers } = useData("/customers", v),
    { data: settings } = useData("/settings");
  function add(p: Part) {
    if (checkout.current.pending || busy) return;
    setError("");
    const edited = addPartToCart(cart, lines, p);
    setLines(edited.lines);
    setCart(edited.cart);
    setKey(crypto.randomUUID());
  }
  async function save() {
    const x = await api("/carts", "POST", {
      ...(cart ? { id: cart.id } : {}),
      customerId: customer || null,
      lines: lines.map(({ partId, qty }) => ({ partId, qty })),
    });
    setCart(x);
    setV(v + 1);
    return x;
  }
  return (
    <>
      <Notice>{error}</Notice>
      {checkout.current.pending && (
        <Notice>
          The previous posting result is uncertain. Retry the same sale to
          recover its receipt before editing this cart.
        </Notice>
      )}
      <div className="counter-grid">
        <section className="panel counter-find">
          <div className="panel-title">
            <h2>Find a part</h2>
            <span className="badge">Scanner ready</span>
          </div>
          <PartPicker onPick={add} />
          <p className="hint">
            Search by part number, barcode or name. Confirm vehicle fitment
            before sale.
          </p>
        </section>
        <section className="panel basket">
          <div className="panel-title">
            <h2>Current sale</h2>
            <button
              className="text-button"
              disabled={busy || checkout.current.pending}
              onClick={() => {
                setLines([]);
                setCart(null);
                setKey(crypto.randomUUID());
                setPayment("");
              }}
            >
              New sale
            </button>
          </div>
          <Field label="Customer">
            <select
              disabled={busy || checkout.current.pending}
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            >
              <option value="">Walk-in customer</option>
              {customers?.map((c: any) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <button
            className="text-button"
            onClick={async () => {
              const name = prompt("Customer name");
              if (name)
                try {
                  const c = await api("/customers", "POST", { name });
                  setCustomer(c.id);
                  setV(v + 1);
                } catch (e: any) {
                  setError(e.message);
                }
            }}
          >
            + Add customer
          </button>
          <div className="cart-lines">
            {!lines.length ? (
              <div className="empty">Add parts to start a sale.</div>
            ) : (
              lines.map((l) => (
                <div className="cart-line" key={l.partId}>
                  <div>
                    <b>{l.name}</b>
                    <small>
                      {l.sku} · {l.price} each
                    </small>
                  </div>
                  <input
                    aria-label={"Quantity for " + l.sku}
                    disabled={busy || checkout.current.pending}
                    type="number"
                    min="1"
                    step="1"
                    value={l.qty}
                    onChange={(e) => {
                      setLines(
                        lines.map((x) =>
                          x.partId === l.partId
                            ? { ...x, qty: Number(e.target.value) }
                            : x,
                        ),
                      );
                      setCart(invalidateCartTotals(cart));
                      setKey(crypto.randomUUID());
                    }}
                  />
                  <button
                    disabled={busy || checkout.current.pending}
                    aria-label={"Remove " + l.sku}
                    className="quiet"
                    onClick={() => {
                      setLines(lines.filter((x) => x.partId !== l.partId));
                      setCart(invalidateCartTotals(cart));
                    }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
          {cart?.total != null && (
            <div className="totals">
              <span>
                Subtotal <b>{cart.subtotal}</b>
              </span>
              <span>
                Tax <b>{cart.tax}</b>
              </span>
              <strong>
                Total{" "}
                <b>
                  {settings?.currency} {cart.total}
                </b>
              </strong>
            </div>
          )}
          <p className="hint">
            Save the draft to calculate totals. Posting checks current stock and
            shop tax settings.
          </p>
          <button
            disabled={busy || checkout.current.pending || !lines.length}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await save();
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Save draft & calculate
          </button>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const method = new FormData(e.currentTarget).get("method");
              try {
                setReceipt(
                  await checkout.current.complete(save, {
                    key,
                    payment,
                    method: String(method),
                  }),
                );
                setLines([]);
                setCart(null);
                setKey(crypto.randomUUID());
                setPayment("");
                setV(v + 1);
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-grid">
              <Field label="Payment received">
                <input
                  disabled={busy || checkout.current.pending}
                  required
                  type="number"
                  min="0"
                  step=".01"
                  value={payment}
                  onChange={(e) => {
                    setPayment(e.target.value);
                    setKey(crypto.randomUUID());
                  }}
                />
              </Field>
              <Field label="Payment method">
                <select
                  name="method"
                  disabled={busy || checkout.current.pending}
                >
                  <option value="cash">Cash</option>
                  <option value="external">External payment recorded</option>
                </select>
              </Field>
            </div>
            <button className="primary wide" disabled={busy || !lines.length}>
              {busy
                ? "Posting…"
                : checkout.current.pending
                  ? "Retry same sale →"
                  : "Complete sale →"}
            </button>
          </form>
        </section>
      </div>
      <section className="panel">
        <div className="panel-title">
          <h2>Sales & saved drafts</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sales?.map((s: any) => (
              <tr key={s.id}>
                <td className="mono">{short(s.id)}</td>
                <td>{s.customer || "Walk-in"}</td>
                <td>{s.total ?? "—"}</td>
                <td>
                  <span
                    className={"badge " + (s.status === "draft" ? "warn" : "")}
                  >
                    {s.status}
                  </span>
                </td>
                <td>
                  <button
                    disabled={busy || checkout.current.pending}
                    onClick={async () => {
                      if (s.status === "draft") {
                        setCart(s);
                        setLines(s.lines);
                        setCustomer(s.customer_id ?? "");
                        setKey(crypto.randomUUID());
                      } else setReceipt(await api("/sales/" + s.id));
                    }}
                  >
                    {s.status === "draft" ? "Resume" : "View receipt"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {receipt && (
        <Receipt
          sale={receipt}
          role={role}
          close={() => setReceipt(null)}
          returned={() => {
            setReceipt(null);
            setV(v + 1);
          }}
        />
      )}
    </>
  );
}
function Receipt({
  sale,
  role,
  close,
  returned,
}: {
  sale: any;
  role: string;
  close: () => void;
  returned: () => void;
}) {
  const posting = usePosting("return:" + sale.id);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ret, setRet] = useState(false),
    [key] = useState(crypto.randomUUID());
  return (
    <Modal title="Sale receipt" onClose={close} canClose={!busy}>
      <div className="receipt">
        <p className="eyebrow">{sale.settings?.shopName}</p>
        <h2>{short(sale.id)}</h2>
        <p>{new Date(sale.posted_at).toLocaleString()} · Operational receipt</p>
        <table>
          <thead>
            <tr>
              <th>Part</th>
              <th>Qty</th>
              <th>Unit price</th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map((l: any) => (
              <tr key={l.partId}>
                <td>
                  {l.name}
                  <small>{l.sku}</small>
                </td>
                <td>{l.qty}</td>
                <td>{l.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="totals">
          <span>
            Subtotal <b>{sale.subtotal}</b>
          </span>
          <span>
            Tax <b>{sale.tax}</b>
          </span>
          <strong>
            Total{" "}
            <b>
              {sale.settings?.currency} {sale.total}
            </b>
          </strong>
        </div>
      </div>
      <div className="form-actions">
        <button onClick={() => window.print()}>Print receipt</button>
        {role === "manager" && (
          <button onClick={() => setRet(!ret)}>Record a return</button>
        )}
      </div>
      {(ret || posting.pending) && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            const ls = sale.lines
              .map((l: any) => ({
                partId: l.partId,
                qty: Number(f.get(l.partId)),
                restock: f.get("restock-" + l.partId) === "on",
              }))
              .filter((l: any) => l.qty > 0);
            try {
              await posting.submit("/sales/" + sale.id + "/return", {
                key,
                reason: f.get("reason"),
                refundStatus: f.get("refundStatus"),
                lines: ls,
              });
              returned();
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {posting.pending && (
            <Notice>
              A return is awaiting confirmation. Retry recovers the original
              submitted quantities.
            </Notice>
          )}
          <fieldset disabled={busy || posting.pending}>
            <h3>Return quantities</h3>
            {sale.lines.map((l: any) => (
              <div className="return-line" key={l.partId}>
                <Field label={l.name}>
                  <input
                    type="number"
                    name={l.partId}
                    min="0"
                    max={l.qty}
                    defaultValue="0"
                  />
                </Field>
                <label className="check">
                  <input
                    type="checkbox"
                    name={"restock-" + l.partId}
                    defaultChecked
                  />{" "}
                  Return to sellable stock
                </label>
              </div>
            ))}
            <Field label="Reason">
              <input name="reason" required />
            </Field>
            <Field label="Refund status">
              <select name="refundStatus">
                <option value="pending">Pending refund</option>
                <option value="recorded">Refund recorded externally</option>
              </select>
            </Field>
            <p className="hint">
              This records the return. It does not send a refund.
            </p>
          </fieldset>
          <Notice>{error}</Notice>
          <button className="primary" disabled={busy}>
            {posting.pending ? "Retry original return" : "Post return"}
          </button>
        </form>
      )}
      {sale.returns?.length > 0 && (
        <p>{sale.returns.length} return record(s) linked to this sale.</p>
      )}
    </Modal>
  );
}
