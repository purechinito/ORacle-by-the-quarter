export let csrf = "";
export let actorId = "";
export function setCsrf(value: string, userId?: string) {
  csrf = value;
  if (userId) actorId = userId;
}
export async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) {
    if (r.status === 401 && path !== "/login")
      window.dispatchEvent(new Event("quarter:session-expired"));
    const error = new Error(data.error ?? "Request failed") as Error & {
      status: number;
    };
    error.status = r.status;
    throw error;
  }
  return data;
}
