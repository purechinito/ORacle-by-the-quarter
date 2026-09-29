import { PartyPicker } from "../PartyPicker";
import { pesos } from "../locale";
import { usePosting, hasPendingPosting } from "../usePosting";
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
export function Purchasing({ role }: { role: string }) {
  const [v, setV] = useState(0),
    [open, setOpen] = useState<any>(null),
    [receive, setReceive] = useState<any>(null),
    [error, setError] = useState(""),
    [view, setView] = useState<any>(null),
    [page, setPage] = useState(1),
    [filters, setFilters] = useState(emptyFilters);
  const { data: orders, error: loadError } = useData(
    "/purchases?" + historyParams(filters, page),
    v,
  );
  return (
    <>
      <div className="toolbar">
        <span className="muted">
          Purchase orders → partial receipts → shelf stock
        </span>
        {role === "manager" && (
          <button className="primary" onClick={() => setOpen({})}>
            + Purchase order
          </button>
        )}
      </div>
      <HistoryFilters
        value={filters}
        statuses={["draft", "submitted", "partial", "received", "cancelled"]}
        onChange={(f) => {
          setFilters(f);
          setPage(1);
        }}
      />
      <Notice>{error || loadError}</Notice>
      <section className="panel">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Supplier</th>
              <th>Lines</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders?.map((o: any) => (
              <tr key={o.id}>
                <td className="mono">{short(o.id)}</td>
                <td>{o.supplier}</td>
                <td>
                  {o.lines.length}
                  <small>
                    {o.lines.reduce((n: number, l: any) => n + l.received, 0)} /{" "}
                    {o.lines.reduce((n: number, l: any) => n + l.qty, 0)} units
                    received
                  </small>
                </td>
                <td>
                  <span
                    className={
                      "badge " + (o.status === "received" ? "" : "warn")
                    }
                  >
                    {o.status}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button onClick={() => setView(o)}>View order</button>
                    {o.status === "draft" && role === "manager" && (
                      <button onClick={() => setOpen(o)}>Edit draft</button>
                    )}
                    {o.status === "draft" && role === "manager" && (
                      <button
                        onClick={async () => {
                          try {
                            await api(
                              "/purchases/" + o.id + "/submit",
                              "POST",
                              {},
                            );
                            setV(v + 1);
                          } catch (e: any) {
                            setError(e.message);
                          }
                        }}
                      >
                        Submit order
                      </button>
                    )}
                    {(["submitted", "partial"].includes(o.status) ||
                      hasPendingPosting("receipt:" + o.id)) && (
                      <button onClick={() => setReceive(o)}>
                        {hasPendingPosting("receipt:" + o.id)
                          ? "Recover receipt"
                          : "Receive stock"}
                      </button>
                    )}
                    {["draft", "submitted", "partial"].includes(o.status) &&
                      role === "manager" && (
                        <button
                          className="quiet"
                          onClick={async () => {
                            const reason = prompt(
                              "Reason for cancelling outstanding quantities",
                            );
                            if (reason)
                              try {
                                await api(
                                  "/purchases/" + o.id + "/cancel",
                                  "POST",
                                  { reason },
                                );
                                setV(v + 1);
                              } catch (e: any) {
                                setError(e.message);
                              }
                          }}
                        >
                          Cancel remainder
                        </button>
                      )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders?.length === 0 && (
          <div className="empty">
            No purchase orders yet. Start with a supplier and the parts you
            need.
          </div>
        )}
        <Pager page={page} onPage={setPage} count={orders?.length} />
      </section>
      {view && (
        <Modal
          title={"Purchase order · " + short(view.id)}
          onClose={() => setView(null)}
        >
          <p>
            {view.supplier} · {view.status}
          </p>
          {view.cancel_reason && (
            <Notice>Cancellation: {view.cancel_reason}</Notice>
          )}
          <table>
            <thead>
              <tr>
                <th>Part</th>
                <th>Ordered</th>
                <th>Received</th>
                {role === "manager" && <th>Unit cost</th>}
              </tr>
            </thead>
            <tbody>
              {view.lines.map((l: any) => (
                <tr key={l.part_id}>
                  <td>
                    {l.name}
                    <small>{l.sku}</small>
                  </td>
                  <td>{l.qty}</td>
                  <td>{l.received}</td>
                  {role === "manager" && <td>{pesos(l.cost)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
      {open && (
        <NewOrder
          order={open}
          close={() => setOpen(null)}
          saved={() => {
            setOpen(null);
            setV(v + 1);
          }}
        />
      )}
      {receive && (
        <Receive
          order={receive}
          close={() => setReceive(null)}
          saved={() => {
            setReceive(null);
            setV(v + 1);
          }}
        />
      )}
    </>
  );
}
function NewOrder({
  order,
  close,
  saved,
}: {
  order: any;
  close: () => void;
  saved: () => void;
}) {
  const [lines, setLines] = useState<any[]>(
      order.lines?.map((l: any) => ({ ...l, partId: l.part_id })) ?? [],
    ),
    [error, setError] = useState(""),
    [v, setV] = useState(0),
    [supplier, setSupplier] = useState(order.supplier_id ?? ""),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title={order.id ? "Edit purchase draft" : "New purchase order"}
      onClose={close}
      canClose={!busy}
    >
      <fieldset disabled={busy}>
        <PartyPicker
          kind="suppliers"
          value={supplier}
          onChange={setSupplier}
          disabled={busy}
        />
        <button
          className="text-button"
          onClick={async () => {
            const name = prompt("Supplier name");
            if (name)
              try {
                const s = await api("/suppliers", "POST", { name });
                setSupplier(s.id);
                setV(v + 1);
              } catch (e: any) {
                setError(e.message);
              }
          }}
        >
          + Add supplier
        </button>
        <PartPicker
          disabled={busy}
          onPick={(p: Part) => {
            if (!lines.some((l) => l.partId === p.id))
              setLines([
                ...lines,
                { partId: p.id, name: p.name, qty: 1, cost: "0.00" },
              ]);
          }}
        />
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api(
                order.id ? "/purchases/" + order.id : "/purchases",
                order.id ? "PUT" : "POST",
                {
                  supplierId: supplier,
                  lines: lines.map(({ partId, qty, cost }) => ({
                    partId,
                    qty,
                    cost,
                  })),
                },
              );
              saved();
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {lines.map((l, i) => (
            <div className="purchase-line" key={l.partId}>
              <b>{l.name}</b>
              <Field label="Quantity">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={l.qty}
                  onChange={(e) =>
                    setLines(
                      lines.map((x, j) =>
                        i === j ? { ...x, qty: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Unit cost (₱)">
                <input
                  type="number"
                  min="0"
                  step=".01"
                  value={l.cost}
                  onChange={(e) =>
                    setLines(
                      lines.map((x, j) =>
                        i === j ? { ...x, cost: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
              <button
                type="button"
                aria-label={"Remove " + l.name}
                onClick={() => setLines(lines.filter((_, j) => i !== j))}
              >
                ×
              </button>
            </div>
          ))}
          <Notice>{error}</Notice>
          <div className="form-actions">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={busy || !supplier || !lines.length}
            >
              Save draft order
            </button>
          </div>
        </form>
      </fieldset>
    </Modal>
  );
}
function Receive({
  order,
  close,
  saved,
}: {
  order: any;
  close: () => void;
  saved: () => void;
}) {
  const posting = usePosting("receipt:" + order.id);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [key] = useState(crypto.randomUUID());
  return (
    <Modal
      title={"Receive · " + short(order.id)}
      onClose={close}
      canClose={!busy}
    >
      <p>{order.supplier} · Enter only the quantity physically received.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            await posting.submit("/purchases/" + order.id + "/receive", {
              key,
              lines: order.lines
                .map((l: any) => ({
                  partId: l.part_id,
                  qty: Number(f.get(l.part_id)),
                }))
                .filter((l: any) => l.qty > 0),
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
            A receipt is awaiting confirmation. Retry recovers the original
            submitted quantities.
          </Notice>
        )}
        <fieldset disabled={busy || posting.pending}>
          {order.lines
            .filter((l: any) => l.qty > l.received)
            .map((l: any) => (
              <Field
                label={l.name + " · " + (l.qty - l.received) + " outstanding"}
                key={l.part_id}
              >
                <input
                  name={l.part_id}
                  type="number"
                  min="0"
                  max={l.qty - l.received}
                  step="1"
                  defaultValue="0"
                />
              </Field>
            ))}
        </fieldset>
        <Notice>{error}</Notice>
        <div className="form-actions">
          <button type="button" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {posting.pending ? "Retry original receipt" : "Post receipt"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
