import { useEffect, useState } from "react";
import { api, setCsrf } from "./api";
import { Field, Notice, useData } from "./components";
import { Catalog } from "./features/Catalog";
import { Counter } from "./features/Counter";
import { Purchasing } from "./features/Purchasing";
import { Stock, Settings, Reports } from "./features/Operations";
export default function App() {
  const [user, setUser] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState("Overview"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/me")
      .then((x) => {
        setUser(x.user);
        setCsrf(x.csrf, x.user.id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <div className="loading">Opening your workspace…</div>;
  if (!user)
    return (
      <div className="login">
        <section className="login-story">
          <div className="wordmark">
            Q<span>QUARTER</span>
          </div>
          <p className="eyebrow">AUTO SUPPLY / OPERATIONS</p>
          <h1>
            Every part.
            <br />
            In its place.
          </h1>
          <p>
            A clear view of your stock, your counter
            <br />
            and the work that keeps business moving.
          </p>
          <div className="rack">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <small>Original business software · Version 0.1</small>
        </section>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              const x = await api("/login", "POST", Object.fromEntries(f));
              setCsrf(x.csrf, x.user.id);
              setUser(x.user);
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="eyebrow">YOUR WORKSPACE</p>
          <h2>Welcome back.</h2>
          <p>Sign in to open the shop.</p>
          <Field label="Username">
            <input name="username" autoComplete="username" required autoFocus />
          </Field>
          <Field label="Password">
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <Notice>{error}</Notice>
          <button disabled={busy} className="primary">
            {busy ? "Signing in…" : "Sign in →"}
          </button>
          <small>Use your individual staff account.</small>
        </form>
      </div>
    );
  const pages = [
    ["Overview", "◫"],
    ["Parts", "▦"],
    ...(user.role !== "stock" ? [["Counter sales", "↗"]] : []),
    ...(user.role !== "counter" ? [["Purchasing", "↓"]] : []),
    ["Stock movements", "⇄"],
    ["Reports", "▤"],
    ...(user.role === "manager" ? [["Settings", "⚙"]] : []),
  ];
  return (
    <div className="app">
      <aside>
        <div className="wordmark">
          Q
          <span>
            QUARTER<small>AUTO SUPPLY ERP</small>
          </span>
        </div>
        <div className="workspace">
          <span className="status-dot" /> Main stockroom
          <small>One connected shop</small>
        </div>
        <nav aria-label="Main navigation">
          {pages.map(([name, icon]) => (
            <button
              key={name}
              aria-current={page === name ? "page" : undefined}
              className={page === name ? "active" : ""}
              onClick={() => setPage(name)}
            >
              <span>{icon}</span>
              {name}
              {page === name && <i />}
            </button>
          ))}
        </nav>
        <div className="aside-bottom">
          <div className="avatar">{user.username[0].toUpperCase()}</div>
          <div>
            {user.username}
            <small>{user.role}</small>
          </div>
          <button
            aria-label="Sign out"
            title="Sign out"
            onClick={async () => {
              await api("/logout", "POST");
              setUser(null);
              setPage("Overview");
            }}
          >
            ↪
          </button>
        </div>
      </aside>
      <main>
        <div className="topbar">
          <span>
            OPERATIONS <b>/</b> {page}
          </span>
          <span>
            <i className="status-dot" /> Connected{" "}
            <span className="divider">|</span>{" "}
            {new Date().toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
        <div className="page">
          <header className="page-heading">
            <div>
              <p className="eyebrow">YOUR BUSINESS, IN FOCUS</p>
              <h1>{page === "Overview" ? "Shop overview" : page}</h1>
              <p>
                {
                  (
                    {
                      Overview:
                        "See what needs attention. Keep the day moving.",
                      Parts:
                        "The right part starts with the right information.",
                      "Counter sales":
                        "Find it. Check it. Get your customer moving.",
                      Purchasing:
                        "From supplier order to shelf, without losing track.",
                      "Stock movements":
                        "Every movement has a reason and a record.",
                      Reports: "The numbers behind your daily operations.",
                      Settings: "Make this workspace work for your shop.",
                    } as any
                  )[page]
                }
              </p>
            </div>
            <span className="location-pill">● Main stockroom</span>
          </header>
          {page === "Overview" ? (
            <Overview navigate={setPage} />
          ) : page === "Parts" ? (
            <Catalog role={user.role} />
          ) : page === "Counter sales" ? (
            <Counter role={user.role} />
          ) : page === "Purchasing" ? (
            <Purchasing role={user.role} />
          ) : page === "Stock movements" ? (
            <Stock role={user.role} />
          ) : page === "Reports" ? (
            <Reports role={user.role} />
          ) : (
            <Settings />
          )}
        </div>
      </main>
    </div>
  );
}
function Overview({ navigate }: { navigate: (p: string) => void }) {
  const { data: d, error } = useData("/reports");
  return (
    <>
      <Notice>{error}</Notice>
      {d ? (
        <>
          <div className="stat-grid">
            {[
              [
                "Active catalog",
                d.parts.toLocaleString(),
                "parts in your catalog",
              ],
              [
                "Stock on hand",
                d.units.toLocaleString(),
                "units across the shop",
              ],
              [
                "Recorded sales",
                `${d.currency} ${d.salesTotal}`,
                `${d.salesCount} posted sales · all time`,
              ],
              ["Needs restocking", d.low, "parts at or below reorder point"],
            ].map(([label, value, note]) => (
              <article className="stat" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{note}</small>
              </article>
            ))}
          </div>
          <div className="overview-grid">
            <section className="panel">
              <div className="panel-title">
                <div>
                  <p className="eyebrow">STOCK WATCH</p>
                  <h2>Time to replenish</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("Parts")}
                >
                  View all parts ↗
                </button>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Part / SKU</th>
                    <th>Bin</th>
                    <th>On hand</th>
                    <th>Reorder at</th>
                  </tr>
                </thead>
                <tbody>
                  {d.lowStock.slice(0, 7).map((p: any) => (
                    <tr key={p.id}>
                      <td>
                        <b>{p.name}</b>
                        <small>{p.sku}</small>
                      </td>
                      <td>{p.bin || "—"}</td>
                      <td>
                        <span className="badge warn">{p.stock} units</span>
                      </td>
                      <td>{p.reorder}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!d.lowStock.length && (
                <div className="empty">
                  No low-stock parts. You're ready for the next order.
                </div>
              )}
            </section>
            <section className="action-panel">
              <p className="eyebrow">THE DAY'S WORK</p>
              <h2>
                Keep things
                <br />
                moving.
              </h2>
              <p>
                Use the catalog to check availability and keep every stock
                change traceable.
              </p>
              <button onClick={() => navigate("Parts")}>
                Find a part <span>↗</span>
              </button>
              <button onClick={() => navigate("Stock movements")}>
                Check stock history <span>↗</span>
              </button>
              <div className="work-count">
                <strong>{d.outstanding}</strong>
                <span>
                  purchase orders
                  <br />
                  awaiting stock
                </span>
              </div>
            </section>
          </div>
          <section className="panel recent">
            <div className="panel-title">
              <h2>Recent sales</h2>
              <span className="muted">Posted transactions</span>
            </div>
            {d.recent.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Posted</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent.map((s: any) => (
                    <tr key={s.id}>
                      <td className="mono">{s.id.slice(0, 8).toUpperCase()}</td>
                      <td>{new Date(s.posted_at).toLocaleString()}</td>
                      <td>
                        {d.currency} {s.total}
                      </td>
                      <td>
                        <span className="badge">Posted</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">Your posted sales will appear here.</div>
            )}
          </section>
        </>
      ) : (
        <div className="empty">Loading shop overview…</div>
      )}
    </>
  );
}
