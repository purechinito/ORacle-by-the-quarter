import { test, expect } from "vitest";
import { createCheckout } from "../../apps/web/src/checkout";
test("lost posting response retries the same saved cart without creating another", async () => {
  let saves = 0,
    calls: any[] = [],
    lose = true;
  const checkout = createCheckout(
    async (path: string, method?: string, body?: any) => {
      calls.push({ path, body });
      if (path.endsWith("/post") && lose) {
        lose = false;
        throw Error("Connection lost");
      }
      return { id: "sale-a", status: "posted" };
    },
  );
  const save = async () => {
    saves++;
    return { id: "sale-a" };
  };
  const input = { key: "retry-key", payment: "10.00", method: "cash" };
  await expect(checkout.complete(save, input)).rejects.toThrow(
    "Connection lost",
  );
  expect(checkout.pending).toBe(true);
  expect(await checkout.complete(save, input)).toEqual({
    id: "sale-a",
    status: "posted",
  });
  expect(saves).toBe(1);
  expect(calls[0]).toEqual(calls[1]);
  expect(checkout.pending).toBe(false);
});
