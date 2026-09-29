import type { AttemptStore } from "./posting";
type Attempt = {
  id: string;
  input: { key: string; payment: string; method: string };
};
export function createCheckout(
  request: (path: string, method?: string, body?: any) => Promise<any>,
  store?: AttemptStore,
) {
  let attempt: Attempt | null = store?.get() ? JSON.parse(store.get()!) : null;
  return {
    get pending() {
      return attempt !== null;
    },
    async complete(save: () => Promise<any>, input: Attempt["input"]) {
      if (!attempt) {
        const cart = await save();
        const next = { id: cart.id, input: { ...input } };
        store?.set(JSON.stringify(next));
        attempt = next;
      }
      try {
        await request("/sales/" + attempt.id + "/post", "POST", attempt.input);
        const receipt = await request("/sales/" + attempt.id);
        store?.clear();
        attempt = null;
        return receipt;
      } catch (error: any) {
        if ([400, 404, 409, 422].includes(error.status)) {
          store?.clear();
          attempt = null;
        }
        throw error;
      }
    },
  };
}
