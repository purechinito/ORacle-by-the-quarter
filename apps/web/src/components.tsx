import { useEffect, useState, type ReactNode } from "react";
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
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setError("");
    api(path)
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [path, version]);
  return { data, error };
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
  return (
    <div
      className="overlay"
      onKeyDown={(e) => {
        if (e.key === "Escape" && canClose) onClose();
      }}
    >
      <section
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
export function PartPicker({ onPick }: { onPick: (part: Part) => void }) {
  const [q, setQ] = useState("");
  const { data, error } = useData(
    "/parts?q=" + encodeURIComponent(q) + "&limit=8",
  );
  return (
    <div className="picker">
      <input
        autoFocus
        aria-label="Find part"
        placeholder="Scan barcode, SKU or part name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && data?.items.length === 1) {
            e.preventDefault();
            onPick(data.items[0]);
            setQ("");
          }
        }}
      />
      <Notice>{error}</Notice>
      <div className="pick-results">
        {data?.items.map((p: Part) => (
          <button
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
