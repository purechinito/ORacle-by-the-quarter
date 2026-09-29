import { useState } from "react";
import { actorId, api } from "../api";
import { Field, Modal, Notice, useData } from "../components";
export function Staff() {
  const [v, setV] = useState(0),
    [action, setAction] = useState<{ type: string; user?: any } | null>(null),
    [message, setMessage] = useState("");
  const { data, error } = useData("/users", v);
  return (
    <section className="panel pad">
      <div className="panel-title">
        <div>
          <h2>Staff & access</h2>
          <p className="muted">
            Individual accounts. Traceable access changes.
          </p>
        </div>
        <button onClick={() => setAction({ type: "create" })}>
          + Add staff
        </button>
      </div>
      <Notice>{error || message}</Notice>
      <div className="staff-records">
        {data?.map((u: any) => (
          <article className="staff-record" key={u.id}>
            <div className="staff-identity">
              <span className="avatar">{u.username[0].toUpperCase()}</span>
              <div>
                <b>
                  {u.username}
                  {u.id === actorId ? " · You" : ""}
                </b>
                <small>
                  {u.role} · {u.active ? "Active" : "Inactive"}
                </small>
              </div>
            </div>
            <div className="staff-actions">
              <button
                disabled={u.id === actorId}
                onClick={() => setAction({ type: "edit", user: u })}
              >
                Edit access
              </button>
              <button onClick={() => setAction({ type: "password", user: u })}>
                Reset password
              </button>
              <button onClick={() => setAction({ type: "revoke", user: u })}>
                Sign out devices
              </button>
            </div>
          </article>
        ))}
      </div>
      <p className="hint">
        Access and password changes end the affected account’s sessions. Another
        manager must change your own role or active status.
      </p>
      {action && (
        <StaffAction
          action={action}
          close={() => setAction(null)}
          saved={() => {
            setMessage("Staff action saved.");
            setAction(null);
            setV(v + 1);
            if (action.user?.id === actorId)
              window.dispatchEvent(new Event("quarter:session-expired"));
          }}
        />
      )}
    </section>
  );
}
function StaffAction({
  action,
  close,
  saved,
}: {
  action: { type: string; user?: any };
  close: () => void;
  saved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const type = action.type,
    u = action.user;
  const title =
    type === "create"
      ? "New staff account"
      : type === "edit"
        ? "Change staff access"
        : type === "password"
          ? "Reset staff password"
          : "Sign out all devices";
  return (
    <Modal title={title} onClose={close} canClose={!busy}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const form = e.currentTarget,
            f = Object.fromEntries(new FormData(form));
          try {
            if (type === "create") await api("/users", "POST", f);
            if (type === "edit")
              await api("/users/" + u.id, "PUT", {
                role: f.role,
                active: f.active === "true",
                version: u.version,
                reason: f.reason,
              });
            if (type === "password")
              await api("/users/" + u.id + "/password", "POST", {
                password: f.password,
                reason: f.reason,
              });
            if (type === "revoke")
              await api("/users/" + u.id + "/revoke-sessions", "POST", {
                reason: f.reason,
              });
            form.reset();
            saved();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          {u && (
            <p>
              <b>{u.username}</b> · {u.role}
            </p>
          )}
          {type === "create" && (
            <Field label="Username">
              <input
                name="username"
                required
                minLength={2}
                maxLength={80}
                autoComplete="off"
              />
            </Field>
          )}
          {(type === "create" || type === "password") && (
            <Field label="New password (at least 12 characters)">
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={200}
                required
                autoComplete="new-password"
              />
            </Field>
          )}
          {(type === "create" || type === "edit") && (
            <Field label="Role">
              <select name="role" defaultValue={u?.role || "counter"}>
                <option value="counter">Counter staff</option>
                <option value="stock">Stock clerk</option>
                <option value="manager">Manager</option>
              </select>
            </Field>
          )}
          {type === "edit" && (
            <Field label="Account status">
              <select name="active" defaultValue={String(u.active)}>
                <option value="true">Active</option>
                <option value="false">Inactive — block access</option>
              </select>
            </Field>
          )}
          {type !== "create" && (
            <>
              <Field label="Reason for this action">
                <input name="reason" required maxLength={200} />
              </Field>
              <p className="hint">
                This action is recorded in the activity log and ends all current
                sessions for this account.
                {type === "password"
                  ? " Confirm the staff member’s identity and share the new password privately."
                  : ""}
              </p>
            </>
          )}
          <Notice>{error}</Notice>
          <div className="modal-actions">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button className="primary">
              {busy
                ? "Saving…"
                : type === "revoke"
                  ? "Confirm sign-out"
                  : type === "password"
                    ? "Confirm password reset"
                    : "Save account"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
