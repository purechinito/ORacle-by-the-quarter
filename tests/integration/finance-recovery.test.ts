import { test, expect } from "vitest";
import { createPosting } from "../../apps/web/src/posting";

test("an uncertain reversal exposes and recovers the original date and reason after reopening", async () => {
  let saved: string | null = null;
  const store = {
    get: () => saved,
    set: (value: string) => {
      saved = value;
    },
    clear: () => {
      saved = null;
    },
  };
  const body = {
    key: "retained-key",
    date: "2026-10-01",
    reason: "Correct contribution",
  };
  const first = createPosting(async () => {
    throw Error("Connection lost");
  }, store);
  await expect(
    first.submit("/finance/journals/original/reverse", body),
  ).rejects.toThrow();
  body.date = "2026-10-02";
  const calls: any[] = [];
  const reopened = createPosting(async (...args) => {
    calls.push(args);
    return { id: "reversal" };
  }, store);
  expect(reopened.pendingAction).toEqual({
    path: "/finance/journals/original/reverse",
    body: {
      key: "retained-key",
      date: "2026-10-01",
      reason: "Correct contribution",
    },
  });
  await reopened.submit("", {});
  expect(calls[0][2].date).toBe("2026-10-01");
  expect(reopened.pendingAction).toBeNull();
});
