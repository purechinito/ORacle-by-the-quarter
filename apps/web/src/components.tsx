import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
export type Part = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  price: string;
  stock: number;
  reorder: number;
  bin: string;
  active: boolean;
  aliases: string[];
  fitments: any[];
  substitutes: string[];
};
export function useData(path: string, version = 0) {
  const [result, setResult] = useState<{
    path: string;
    version: number;
    data: any;
    error: string;
  } | null>(null);
  useEffect(() => {
    let live = true;
    api(path)
      .then((d) => {
        if (live) setResult({ path, version, data: d, error: "" });
      })
      .catch((e) => {
        if (live) setResult({ path, version, data: null, error: e.message });
      });
    return () => {
      live = false;
    };
  }, [path, version]);
  const current = result?.path === path && result.version === version;
  return {
    data: current ? result.data : null,
    error: current ? result.error : "",
  };
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return children ? (
    <div role="alert" className="notice">
      {children}
    </div>
  ) : null;
}
export function Modal({
  title,
  children,
  onClose,
  canClose = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  canClose?: boolean;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div
      className="overlay"
      onKeyDown={(e) => {
        if (e.key === "Escape" && canClose) onClose();
        if (e.key === "Tab") {
          const nodes = Array.from(
            panel.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
            ) ?? [],
          ).filter((x) => x.offsetParent !== null);
          const first = nodes[0],
            last = nodes.at(-1);
          if (!first) {
            e.preventDefault();
            return;
          }
          if (
            e.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === panel.current)
          ) {
            e.preventDefault();
            last?.focus();
          }
          if (
            !e.shiftKey &&
            (document.activeElement === last ||
              document.activeElement === panel.current)
          ) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <section
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
      >
        <header>
          <h2>{title}</h2>
          <button
            onClick={onClose}
            disabled={!canClose}
            aria-label="Close dialog"
            className="quiet"
          >
            ✕
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function PartPicker({
  onPick,
  disabled = false,
  contextKey = "",
  includeInactive = false,
}: {
  onPick: (part: Part) => void;
  disabled?: boolean;
  contextKey?: string;
  includeInactive?: boolean;
}) {
  const [q, setQ] = useState(""),
    [scanning, setScanning] = useState(false),
    [scanError, setScanError] = useState("");
  const scanBusy = useRef(false),
    input = useRef<HTMLInputElement>(null);
  const current = useRef({ onPick, disabled, contextKey });
  current.current = { onPick, disabled, contextKey };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!scanning) input.current?.focus();
  }, [scanning]);
  const { data, error } = useData(
    "/parts?q=" +
      encodeURIComponent(q) +
      "&limit=8&active=" +
      (includeInactive ? "all" : "true"),
  );
  return (
    <div className="picker">
      <input
        ref={input}
        disabled={scanning || disabled}
        autoFocus
        aria-label="Find part"
        placeholder="Scan barcode, SKU or part name…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setScanError("");
        }}
        onKeyDown={async (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (!q.trim() || scanBusy.current) return;
            scanBusy.current = true;
            setScanning(true);
            setScanError("");
            try {
              const found = await api(
                "/parts?q=" +
                  encodeURIComponent(q) +
                  "&limit=8&active=" +
                  (includeInactive ? "all" : "true"),
              );
              if (!mounted.current) return;
              if (
                current.current.disabled ||
                current.current.contextKey !== contextKey
              ) {
                setScanError(
                  "The current form changed during lookup. Scan again when ready.",
                );
                return;
              }
              if (found.total === 1) {
                current.current.onPick(found.items[0]);
                setQ("");
              } else
                setScanError(
                  found.total
                    ? "Several parts match. Choose the correct part below."
                    : "No matching part found.",
                );
            } catch (error: any) {
              if (mounted.current) setScanError(error.message);
            } finally {
              scanBusy.current = false;
              if (mounted.current) setScanning(false);
            }
          }
        }}
      />
      <Notice>{error || scanError}</Notice>
      {scanning && <p role="status">Looking up scanned part…</p>}
      <div className="pick-results">
        {data?.items.map((p: Part) => (
          <button
            disabled={scanning || disabled}
            type="button"
            key={p.id}
            onClick={() => {
              onPick(p);
              setQ("");
            }}
          >
            <span>
              <b>{p.name}</b>
              <small>
                {p.sku} · {p.brand || "Unbranded"} · {p.bin || "No bin"}
                {!p.active ? " · Inactive" : ""}
              </small>
            </span>
            <span>
              {p.price}
              <small>{p.stock} in stock</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
export const short = (s: string) => s.slice(0, 8).toUpperCase();

export function Pager({
  page,
  onPage,
  count,
  limit = 25,
}: {
  page: number;
  onPage: (page: number) => void;
  count?: number;
  limit?: number;
}) {
  return (
    <footer className="pagination">
      <button disabled={page === 1} onClick={() => onPage(page - 1)}>
        ← Previous
      </button>
      <span>Page {page}</span>
      <button
        disabled={count === undefined || count < limit}
        onClick={() => onPage(page + 1)}
      >
        Next →
      </button>
    </footer>
  );
}
export function HistoryFilters({
  value,
  onChange,
  statuses = [],
}: {
  value: { q: string; from: string; to: string; status: string };
  onChange: (v: {
    q: string;
    from: string;
    to: string;
    status: string;
  }) => void;
  statuses?: string[];
}) {
  return (
    <div className="toolbar history-filters">
      <Field label="Search history">
        <input
          placeholder="Reference, name or part…"
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
        />
      </Field>
      {statuses.length > 0 && (
        <Field label="Status">
          <select
            value={value.status}
            onChange={(e) => onChange({ ...value, status: e.target.value })}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      )}
      <Field label="From date">
        <input
          type="date"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
        />
      </Field>
      <Field label="Through date">
        <input
          type="date"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
        />
      </Field>
    </div>
  );
}
export const emptyFilters = { q: "", from: "", to: "", status: "" };
export function historyParams(filters: typeof emptyFilters, page: number) {
  return new URLSearchParams({
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    page: String(page),
  }).toString();
}
