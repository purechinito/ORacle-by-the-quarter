import { beforeAll, afterAll, test, expect } from "vitest";
import pg from "pg";
import { setup } from "./support";
import { migrate } from "../../apps/api/src/db";
import { snapshot, restoreSnapshot } from "../../scripts/snapshot";
let t: Awaited<ReturnType<typeof setup>>,
  m: Record<string, string>,
  cash: any,
  equity: any,
  income: any,
  period: any,
  october: any,
  posted: any;
beforeAll(async () => {
  t = await setup();
  m = await t.login();
});
afterAll(async () => {
  await t?.close();
});
const line = (account: any, debit: string, credit = "0") => ({
  accountId: account.id,
  debit,
  credit,
  description: "",
});
async function draft(date: string, lines: any[], memo = "Journal test") {
  return t.request(m, "POST", "/api/finance/journals", {
    date,
    memo,
    lines,
    currency: "PHP",
  });
}
test("chart accounts and non-overlapping fiscal periods persist as date-only PHP setup", async () => {
  const a = await t.request(m, "POST", "/api/finance/accounts", {
    code: "1000",
    name: "Cash",
    type: "asset",
  });
  expect(a.statusCode).toBe(200);
  cash = a.json();
  equity = (
    await t.request(m, "POST", "/api/finance/accounts", {
      code: "3000",
      name: "Capital",
      type: "equity",
    })
  ).json();
  income = (
    await t.request(m, "POST", "/api/finance/accounts", {
      code: "4000",
      name: "Income",
      type: "income",
    })
  ).json();
  const p = await t.request(m, "POST", "/api/finance/periods", {
    name: "September 2026",
    from: "2026-09-01",
    to: "2026-09-30",
  });
  expect(p.statusCode).toBe(200);
  period = p.json();
  expect(period.starts_on).toBe("2026-09-01");
  october = (
    await t.request(m, "POST", "/api/finance/periods", {
      name: "October 2026",
      from: "2026-10-01",
      to: "2026-10-31",
    })
  ).json();
  const overlap = await t.request(m, "POST", "/api/finance/periods", {
    name: "Overlap",
    from: "2026-09-30",
    to: "2026-10-02",
  });
  expect(overlap.statusCode).toBe(409);
  expect(overlap.json().error).toMatch(/overlap/i);
  expect(
    (
      await t.request(m, "POST", "/api/finance/periods", {
        name: "Invalid",
        from: "2026-02-30",
        to: "2026-03-01",
      })
    ).statusCode,
  ).toBe(400);
});
test("balanced draft posts once, is immutable, and appears in trial balance and ledger", async () => {
  expect(cash?.id).toBeDefined();
  const d = await draft(
    "2026-09-28",
    [line(cash, "1000"), line(equity, "0", "1000")],
    "Opening contribution",
  );
  expect(d.statusCode).toBe(200);
  posted = d.json();
  const key = crypto.randomUUID();
  const r = await t.request(
    m,
    "POST",
    "/api/finance/journals/" + posted.id + "/post",
    { key },
  );
  expect(r.statusCode).toBe(200);
  expect(r.json().status).toBe("posted");
  expect(
    (
      await t.request(
        m,
        "POST",
        "/api/finance/journals/" + posted.id + "/post",
        { key },
      )
    ).json().id,
  ).toBe(posted.id);
  expect(
    (
      await t.request(
        m,
        "POST",
        "/api/finance/journals/" + posted.id + "/post",
        { key: crypto.randomUUID() },
      )
    ).json().id,
  ).toBe(posted.id);
  expect(
    (
      await t.request(m, "PUT", "/api/finance/journals/" + posted.id, {
        date: "2026-09-28",
        memo: "Changed",
        version: 1,
        lines: [line(cash, "1"), line(equity, "0", "1")],
      })
    ).statusCode,
  ).toBe(409);
  await expect(
    t.pool.query(
      "UPDATE gl_journal_lines SET debit=2 WHERE journal_id=$1 AND debit>0",
      [posted.id],
    ),
  ).rejects.toThrow(/immutable/i);
  await expect(
    t.pool.query("UPDATE gl_journals SET memo='changed' WHERE id=$1", [
      posted.id,
    ]),
  ).rejects.toThrow(/immutable/i);
  const tb = (
    await t.request(
      m,
      "GET",
      "/api/finance/trial-balance?from=2026-09-01&to=2026-09-30",
    )
  ).json();
  expect(tb.currency).toBe("PHP");
  expect(tb.totals.closingDebit).toBe("1000.00");
  expect(tb.totals.closingCredit).toBe("1000.00");
  const ledger = (
    await t.request(
      m,
      "GET",
      "/api/finance/ledger?accountId=" +
        cash.id +
        "&from=2026-09-01&to=2026-09-30",
    )
  ).json();
  expect(ledger.items).toHaveLength(1);
  expect(ledger.items[0].debit).toBe("1000.00");
});
test("invalid journals never enter the posted ledger", async () => {
  expect(cash?.id).toBeDefined();
  for (const lines of [[], [line(cash, "0")], [line(cash, "2", "2")]])
    expect((await draft("2026-09-28", lines)).statusCode).toBe(400);
  const unbalanced = (
    await draft("2026-09-28", [line(cash, "20"), line(income, "0", "19")])
  ).json();
  expect(
    (
      await t.request(
        m,
        "POST",
        "/api/finance/journals/" + unbalanced.id + "/post",
        { key: crypto.randomUUID() },
      )
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await t.pool.query("SELECT status FROM gl_journals WHERE id=$1", [
        unbalanced.id,
      ])
    ).rows[0].status,
  ).toBe("draft");
  expect(
    (
      await t.request(m, "POST", "/api/finance/journals", {
        currency: "USD",
        date: "2026-09-28",
        memo: "Foreign",
        lines: [line(cash, "2"), line(income, "0", "2")],
      })
    ).statusCode,
  ).toBe(400);
  const inactive = (
    await t.request(m, "POST", "/api/finance/accounts", {
      code: "4999",
      name: "Inactive",
      type: "income",
      active: false,
    })
  ).json();
  const d = await draft("2026-09-28", [
    line(cash, "10"),
    line(inactive, "0", "10"),
  ]);
  expect(d.statusCode).toBe(409);
});
test("closed periods refuse new posting and authorized reopen requires a reason", async () => {
  expect(period?.id).toBeDefined();
  expect(
    (
      await t.request(
        m,
        "POST",
        "/api/finance/periods/" + period.id + "/close",
        { reason: "Month reviewed" },
      )
    ).statusCode,
  ).toBe(200);
  const d = (
    await draft("2026-09-29", [line(cash, "10"), line(income, "0", "10")])
  ).json();
  expect(
    (
      await t.request(m, "POST", "/api/finance/journals/" + d.id + "/post", {
        key: crypto.randomUUID(),
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await t.request(
        m,
        "POST",
        "/api/finance/periods/" + period.id + "/reopen",
        {},
      )
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await t.request(
        m,
        "POST",
        "/api/finance/periods/" + period.id + "/reopen",
        { reason: "Approved correction" },
      )
    ).statusCode,
  ).toBe(200);
});
test("period close and posting serialize; a posting waiting behind close is refused", async () => {
  expect(period?.id).toBeDefined();
  const d = (
    await draft("2026-09-29", [line(cash, "7"), line(income, "0", "7")])
  ).json();
  const lock = await t.pool.connect();
  let done = false;
  let posting: any;
  try {
    await lock.query("BEGIN");
    await lock.query("SELECT id FROM gl_periods WHERE id=$1 FOR UPDATE", [
      period.id,
    ]);
    posting = t
      .request(m, "POST", "/api/finance/journals/" + d.id + "/post", {
        key: crypto.randomUUID(),
      })
      .then((r) => {
        done = true;
        return r;
      });
    let blocked = false;
    for (let n = 0; n < 100 && !done; n++) {
      blocked = !!(
        await t.pool.query(
          "SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%FROM gl_periods%' AND pid<>pg_backend_pid() LIMIT 1",
        )
      ).rowCount;
      if (blocked) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(blocked).toBe(true);
    await lock.query("UPDATE gl_periods SET status='closed' WHERE id=$1", [
      period.id,
    ]);
    await lock.query("COMMIT");
    expect((await posting).statusCode).toBe(409);
    expect(
      (await t.pool.query("SELECT status FROM gl_journals WHERE id=$1", [d.id]))
        .rows[0].status,
    ).toBe("draft");
  } finally {
    await lock.query("ROLLBACK");
    lock.release();
    if (posting) await posting;
  }
  await t.request(m, "POST", "/api/finance/periods/" + period.id + "/reopen", {
    reason: "Finish test",
  });
});
test("reversal dates cannot precede the original date-only journal", async () => {
  expect(posted?.id).toBeDefined();
  expect(
    (
      await t.request(
        m,
        "POST",
        "/api/finance/journals/" + posted.id + "/reverse",
        {
          key: crypto.randomUUID(),
          date: "2026-09-27",
          reason: "Invalid prior day",
        },
      )
    ).statusCode,
  ).toBe(400);
});
test("single linked reversal preserves prior-period totals and offsets later balances", async () => {
  expect(posted?.id).toBeDefined();
  const payload = {
    key: crypto.randomUUID(),
    date: "2026-10-01",
    reason: "Reverse test contribution",
  };
  const results = await Promise.all([
    t.request(
      m,
      "POST",
      "/api/finance/journals/" + posted.id + "/reverse",
      payload,
    ),
    t.request(m, "POST", "/api/finance/journals/" + posted.id + "/reverse", {
      ...payload,
      key: crypto.randomUUID(),
    }),
  ]);
  expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
  expect(results.filter((r) => r.statusCode === 409)).toHaveLength(1);
  const reversal = results.find((r) => r.statusCode === 200)!.json();
  expect(reversal.reverses_id).toBe(posted.id);
  const sept = (
    await t.request(
      m,
      "GET",
      "/api/finance/trial-balance?from=2026-09-01&to=2026-09-30",
    )
  ).json();
  expect(sept.totals.closingDebit).toBe("1000.00");
  const oct = (
    await t.request(
      m,
      "GET",
      "/api/finance/trial-balance?from=2026-10-01&to=2026-10-31",
    )
  ).json();
  expect(oct.totals.openingDebit).toBe("1000.00");
  expect(oct.totals.debit).toBe("1000.00");
  expect(oct.totals.closingDebit).toBe("0.00");
  expect(oct.totals.closingCredit).toBe("0.00");
});
test("finance data and mutations are denied to counter and stock users", async () => {
  for (const role of ["counter", "stock"]) {
    const h = await t.login(role);
    for (const path of [
      "accounts",
      "periods",
      "journals",
      "trial-balance",
      "ledger",
    ])
      expect(
        (await t.request(h, "GET", "/api/finance/" + path)).statusCode,
      ).toBe(403);
    expect(
      (
        await t.request(h, "POST", "/api/finance/accounts", {
          code: "BAD",
          name: "Not allowed",
          type: "asset",
        })
      ).statusCode,
    ).toBe(403);
  }
});
test("backup restores posted journals, reversal links, closed periods and report totals atomically", async () => {
  expect(posted?.id).toBeDefined();
  await t.request(m, "POST", "/api/finance/periods/" + period.id + "/close", {
    reason: "Close before backup",
  });
  const copy = await snapshot(t.pool);
  expect(copy.tables.gl_journal_lines.length).toBeGreaterThan(0);
  await t.pool.query("CREATE DATABASE finance_restore");
  const target = new pg.Pool({
    ...t.pool.options,
    password: t.password,
    database: "finance_restore",
  });
  try {
    await migrate(target);
    const corrupt = structuredClone(copy);
    (
      corrupt.tables.gl_journal_lines.find(
        (l: any) => l.journal_id === posted.id && Number(l.debit) > 0,
      ) as any
    ).debit = "999.00";
    await expect(restoreSnapshot(target, corrupt)).rejects.toThrow();
    expect(
      (await target.query("SELECT count(*)::int n FROM gl_journals")).rows[0].n,
    ).toBe(0);
    // A snapshot's row order is not an accounting dependency order.
    copy.tables.gl_journals.reverse();
    await restoreSnapshot(target, copy);
    expect(
      (
        await target.query(
          "SELECT count(*)::int n FROM gl_journals WHERE status='posted'",
        )
      ).rows[0].n,
    ).toBe(2);
    expect(
      (
        await target.query("SELECT status FROM gl_periods WHERE id=$1", [
          period.id,
        ])
      ).rows[0].status,
    ).toBe("closed");
    expect(
      (
        await target.query(
          "SELECT count(*)::int n FROM gl_journals WHERE reverses_id=$1",
          [posted.id],
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (
        await target.query(
          "SELECT sum(l.debit-l.credit)::text balance FROM gl_journal_lines l JOIN gl_journals j ON j.id=l.journal_id WHERE j.status='posted' AND l.account_id=$1",
          [cash.id],
        )
      ).rows[0].balance,
    ).toBe("0.00");
  } finally {
    await target.end();
  }
});

test("lost draft-save response retries the same journal instead of making a duplicate", async () => {
  const key = crypto.randomUUID(),
    body = {
      key,
      date: "2026-10-02",
      memo: "Retryable draft",
      lines: [line(cash, "8"), line(income, "0", "8")],
    };
  const first = await t.request(m, "POST", "/api/finance/journals", body);
  const again = await t.request(m, "POST", "/api/finance/journals", body);
  expect(first.statusCode).toBe(200);
  expect(again.json().id).toBe(first.json().id);
  expect(
    (
      await t.request(m, "POST", "/api/finance/journals", {
        ...body,
        memo: "Different request",
      })
    ).statusCode,
  ).toBe(409);
});

test.each([
  "doubled amounts",
  "wrong account",
  "draft original",
  "reversal of reversal",
  "prior date",
  "draft reversal",
])(
  "restore rejects %s in a reversal and rolls back every table",
  async (fault) => {
    const copy = await snapshot(t.pool);
    const original = copy.tables.gl_journals.find(
      (j: any) => j.id === posted.id,
    ) as any;
    const reverse = copy.tables.gl_journals.find(
      (j: any) => j.reverses_id === posted.id,
    ) as any;
    const reverseLines = copy.tables.gl_journal_lines.filter(
      (l: any) => l.journal_id === reverse.id,
    ) as any[];
    if (fault === "doubled amounts")
      reverseLines.forEach((l) => {
        l.debit = String(Number(l.debit) * 2);
        l.credit = String(Number(l.credit) * 2);
      });
    if (fault === "wrong account")
      reverseLines.find((l) => l.account_id === cash.id).account_id = income.id;
    if (fault === "draft original") original.status = "draft";
    if (fault === "reversal of reversal") original.reverses_id = reverse.id;
    if (fault === "prior date") {
      reverse.journal_date = "2026-09-27";
      reverse.period_id = period.id;
    }
    if (fault === "draft reversal") reverse.status = "draft";
    const database = "reversal_" + fault.replaceAll(" ", "_");
    await t.pool.query("CREATE DATABASE " + database);
    const target = new pg.Pool({
      ...t.pool.options,
      password: t.password,
      database,
    });
    try {
      await migrate(target);
      await expect(restoreSnapshot(target, copy)).rejects.toThrow(/reversal/i);
      for (const table of [
        "users",
        "gl_journals",
        "gl_journal_lines",
        "audit_events",
      ])
        expect(
          (await target.query("SELECT count(*)::int n FROM " + table)).rows[0]
            .n,
        ).toBe(0);
    } finally {
      await target.end();
    }
  },
);
