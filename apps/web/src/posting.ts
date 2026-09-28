export type AttemptStore = {
  get: () => string | null;
  set: (value: string) => void;
  clear: () => void;
};
type Attempt = { path: string; body: any };
export function createPosting(
  request: (path: string, method: string, body: any) => Promise<any>,
  store: AttemptStore,
) {
  let attempt: Attempt | null = null;
  const saved = store.get();
  if (saved) attempt = JSON.parse(saved);
  return {
    get pending() {
      return attempt !== null;
    },
    async submit(path: string, body: any) {
      if (!attempt) {
        const next = { path, body: JSON.parse(JSON.stringify(body)) };
        store.set(JSON.stringify(next));
        attempt = next;
      }
      try {
        const result = await request(attempt.path, "POST", attempt.body);
        store.clear();
        attempt = null;
        return result;
      } catch (error: any) {
        if ([400, 404, 409, 422].includes(error.status)) {
          store.clear();
          attempt = null;
        }
        throw error;
      }
    },
  };
}
