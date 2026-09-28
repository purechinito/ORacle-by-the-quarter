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
    const error = new Error(data.error ?? "Request failed") as Error & {
      status: number;
    };
    error.status = r.status;
    throw error;
  }
  return data;
}
