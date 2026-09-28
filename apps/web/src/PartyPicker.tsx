import { useState } from "react";
import { Field, Notice, useData } from "./components";
export type PartyKind = "customers" | "suppliers";
export function PartyPicker({
  kind,
  value,
  onChange,
  disabled = false,
}: {
  kind: PartyKind;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const { data, error } = useData(
    "/parties/" + kind + "?limit=8&q=" + encodeURIComponent(q),
  );
  const label = kind === "customers" ? "Customer" : "Supplier";
  return (
    <div className="party-picker">
      <Field label={"Find " + label.toLowerCase()}>
        <input
          disabled={disabled}
          value={q}
          placeholder={"Search name, phone or contact…"}
          onChange={(e) => setQ(e.target.value)}
        />
      </Field>
      <Notice>{error}</Notice>
      {value ? (
        <Selected kind={kind} value={value} />
      ) : (
        <p className="hint">
          {kind === "customers"
            ? "Walk-in customer selected."
            : "Choose a supplier for this order."}
        </p>
      )}
      {value && (
        <button
          type="button"
          className="text-button"
          disabled={disabled}
          onClick={() => onChange("")}
        >
          {kind === "customers" ? "Use walk-in customer" : "Clear supplier"}
        </button>
      )}
      {q.trim() && (
        <div className="pick-results">
          {!data && !error && <p role="status">Searching…</p>}
          {data?.items.map((p: any) => (
            <button
              disabled={disabled}
              type="button"
              key={p.id}
              onClick={() => {
                onChange(p.id);
                setQ("");
              }}
            >
              <span>
                <b>{p.name}</b>
                <small>{p.phone || p.contact_name || "No contact saved"}</small>
              </span>
              <span>Select →</span>
            </button>
          ))}
          {data?.total === 0 && (
            <p>No matching active {label.toLowerCase()}.</p>
          )}
          {data?.total > 8 && (
            <p className="hint">
              {data.total} matches. Refine your search to find the right
              account.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
function Selected({ kind, value }: { kind: PartyKind; value: string }) {
  const { data, error } = useData("/parties/" + kind + "/" + value);
  return (
    <>
      <Notice>{error}</Notice>
      <p className="selected-party">
        {data ? (
          <>
            <b>{data.profile.name}</b>
            <small>
              {data.profile.phone || "No phone saved"}
              {!data.profile.active
                ? " · Inactive — choose another account"
                : ""}
            </small>
          </>
        ) : !error ? (
          "Loading selected account…"
        ) : null}
      </p>
    </>
  );
}
