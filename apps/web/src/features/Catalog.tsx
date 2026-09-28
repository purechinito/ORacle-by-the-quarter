import { useState } from "react";
import { api } from "../api";
import { Field, Modal, Notice, useData, type Part } from "../components";
export function Catalog({ role }: { role: string }) {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [v, setV] = useState(0),
    [edit, setEdit] = useState<Part | {} | null>(null),
    [imp, setImp] = useState(false),
    [active, setActive] = useState("true"),
    [make, setMake] = useState(""),
    [model, setModel] = useState(""),
    [year, setYear] = useState("");
  const { data, error } = useData(
    "/parts?" +
      new URLSearchParams({
        q,
        page: String(page),
        active,
        make,
        model,
        ...(year ? { year } : {}),
      }),
    v,
  );
  return (
    <>
      <div className="toolbar">
        <div className="search">
          <span>⌕</span>
          <input
            aria-label="Search parts"
            placeholder="Search SKU, barcode, OEM number or name…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          aria-label="Part status"
          value={active}
          onChange={(e) => {
            setActive(e.target.value);
            setPage(1);
          }}
        >
          <option value="true">Active parts</option>
          <option value="all">All parts</option>
          <option value="false">Inactive parts</option>
        </select>
        {role === "manager" && (
          <>
            <button onClick={() => setImp(true)}>Import CSV</button>
            <button className="primary" onClick={() => setEdit({})}>
              + New part
            </button>
          </>
        )}
      </div>
      <div className="fitment-filter">
        <span>VEHICLE FITMENT</span>
        <input
          aria-label="Vehicle make"
          placeholder="Make"
          value={make}
          onChange={(e) => {
            setMake(e.target.value);
            setPage(1);
          }}
        />
        <input
          aria-label="Vehicle model"
          placeholder="Model"
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            setPage(1);
          }}
        />
        <input
          aria-label="Vehicle year"
          type="number"
          placeholder="Year"
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <Notice>{error}</Notice>
      <section className="panel">
        <div className="panel-title">
          <h2>
            Parts catalog <span className="count">{data?.total ?? "…"}</span>
          </h2>
          <span className="muted">Prices in configured shop currency</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>SKU / Part</th>
                <th>Brand / Category</th>
                <th>Bin</th>
                <th>On hand</th>
                <th>Sell price</th>
                <th>Availability</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((p: Part) => (
                <tr key={p.id} onClick={() => setEdit(p)} className="clickable">
                  <td>
                    <button className="row-link" onClick={() => setEdit(p)}>
                      {p.name}
                    </button>
                    <small className="mono">{p.sku}</small>
                  </td>
                  <td>
                    {p.brand || "—"}
                    <small>{p.category || "Uncategorized"}</small>
                  </td>
                  <td className="mono">{p.bin || "—"}</td>
                  <td>
                    <b>{p.stock}</b>
                  </td>
                  <td>{p.price}</td>
                  <td>
                    <span
                      className={
                        "badge " + (p.stock <= p.reorder ? "warn" : "")
                      }
                    >
                      {!p.active
                        ? "Inactive"
                        : p.stock === 0
                          ? "Out of stock"
                          : p.stock <= p.reorder
                            ? "Low stock"
                            : "In stock"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && !data.items.length && (
          <div className="empty">
            No parts match. Add a part or change your search.
          </div>
        )}
        <footer className="pagination">
          <span>
            {data?.total ?? 0} parts · Page {page}
          </span>
          <div>
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              ← Previous
            </button>
            <button
              disabled={!data || page * 25 >= data.total}
              onClick={() => setPage(page + 1)}
            >
              Next →
            </button>
          </div>
        </footer>
      </section>
      {edit && (
        <PartEditor
          part={edit as Part}
          readonly={role !== "manager"}
          close={() => setEdit(null)}
          saved={() => {
            setEdit(null);
            setV(v + 1);
          }}
        />
      )}
      {imp && (
        <ImportDialog
          close={() => setImp(false)}
          saved={() => {
            setImp(false);
            setV(v + 1);
          }}
        />
      )}
    </>
  );
}
function PartEditor({
  part,
  readonly,
  close,
  saved,
}: {
  part: Part;
  readonly: boolean;
  close: () => void;
  saved: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title={part.id ? "Part details" : "Add a part"} onClose={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = Object.fromEntries(new FormData(e.currentTarget));
          try {
            const fitments = String(f.fitments || "").trim()
              ? String(f.fitments)
                  .trim()
                  .split("\n")
                  .map((s) => {
                    const [make, model, from, to, engine = ""] = s
                      .split("|")
                      .map((x) => x.trim());
                    return {
                      make,
                      model,
                      from: Number(from),
                      to: Number(to),
                      engine,
                    };
                  })
              : [];
            await api(
              "/parts" + (part.id ? "/" + part.id : ""),
              part.id ? "PUT" : "POST",
              {
                ...f,
                reorder: Number(f.reorder),
                active: f.active === "on",
                aliases: String(f.aliases || "")
                  .split("|")
                  .map((x) => x.trim())
                  .filter(Boolean),
                fitments,
                substitutes: part.substitutes ?? [],
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
        <fieldset disabled={readonly || busy}>
          <div className="form-grid">
            {[
              ["sku", "SKU"],
              ["name", "Part name"],
              ["brand", "Brand"],
              ["category", "Category"],
              ["price", "Selling price"],
              ["bin", "Shelf / bin"],
              ["reorder", "Reorder point"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  name={key}
                  defaultValue={
                    (part as any)[key] ?? (key === "reorder" ? "0" : "")
                  }
                  required={["sku", "name", "price"].includes(key)}
                  type={["price", "reorder"].includes(key) ? "number" : "text"}
                  min="0"
                  step={key === "price" ? ".01" : "1"}
                />
              </Field>
            ))}
          </div>
          <Field label="Barcode / OEM / supplier aliases (separate with |)">
            <input name="aliases" defaultValue={part.aliases?.join(" | ")} />
          </Field>
          <Field label="Vehicle fitment — one per line: Make | Model | From year | To year | Engine">
            <textarea
              name="fitments"
              rows={3}
              defaultValue={part.fitments
                ?.map((f) =>
                  [f.make, f.model, f.from, f.to, f.engine].join(" | "),
                )
                .join("\n")}
            />
          </Field>
          <label className="check">
            <input
              type="checkbox"
              name="active"
              defaultChecked={part.active ?? true}
            />{" "}
            Active part
          </label>
        </fieldset>
        <Notice>{error}</Notice>
        <div className="form-actions">
          <button type="button" onClick={close}>
            Close
          </button>
          {!readonly && (
            <button className="primary" disabled={busy}>
              {busy ? "Saving…" : "Save part"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
export function ImportDialog({
  close,
  saved,
  stock = false,
}: {
  close: () => void;
  saved: () => void;
  stock?: boolean;
}) {
  const [csv, setCsv] = useState(""),
    [preview, setPreview] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(commit = false) {
    setBusy(true);
    setError("");
    try {
      if (commit) {
        await api((stock ? "/stock-import" : "/import") + "/commit", "POST", {
          id: preview.id,
        });
        saved();
      } else
        setPreview(
          await api(
            (stock ? "/stock-import" : "/import") + "/preview",
            "POST",
            { csv },
          ),
        );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={stock ? "Import opening stock" : "Import parts"}
      onClose={close}
    >
      <p>
        {stock
          ? "Required columns: sku,qty. Preview opening quantities before posting. Each part may receive opening stock only once."
          : "Required columns: sku,name,price. Optional: brand, category, bin, reorder, aliases. Catalog records only; stock is separate."}
      </p>
      <Field label="Choose a CSV file">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            setCsv((await e.target.files?.[0]?.text()) ?? "");
            setPreview(null);
          }}
        />
      </Field>
      <Field label="CSV preview">
        <textarea
          rows={7}
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setPreview(null);
          }}
          placeholder={"sku,name,price\nFILTER-001,Oil filter,12.50"}
        />
      </Field>
      <Notice>{error}</Notice>
      {preview && (
        <div className="import-result">
          <b>{preview.count} parts validated</b>
          {preview.errors.length ? (
            preview.errors.map((x: string, i: number) => <p key={i}>{x}</p>)
          ) : (
            <p>No errors. Ready to import.</p>
          )}
        </div>
      )}
      <div className="form-actions">
        <button onClick={close}>Cancel</button>
        {preview && !preview.errors.length ? (
          <button disabled={busy} className="primary" onClick={() => run(true)}>
            Import {preview.count} parts
          </button>
        ) : (
          <button
            className="primary"
            disabled={busy || !csv}
            onClick={() => run()}
          >
            Validate file
          </button>
        )}
      </div>
    </Modal>
  );
}
