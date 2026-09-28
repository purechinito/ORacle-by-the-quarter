type Attempt = {
  id: string;
  input: { key: string; payment: string; method: string };
};
export function createCheckout(
  request: (path: string, method?: string, body?: any) => Promise<any>,
) {
  let attempt: Attempt | null = null;
  return {
    get pending() {
      return attempt !== null;
    },
    async complete(save: () => Promise<any>, input: Attempt["input"]) {
      if (!attempt) {
        const cart = await save();
        attempt = { id: cart.id, input: { ...input } };
      }
      try {
        await request("/sales/" + attempt.id + "/post", "POST", attempt.input);
        const receipt = await request("/sales/" + attempt.id);
        attempt = null;
        return receipt;
      } catch (error: any) {
        if (error.status >= 400 && error.status < 500) attempt = null;
        throw error;
      }
    },
  };
}
