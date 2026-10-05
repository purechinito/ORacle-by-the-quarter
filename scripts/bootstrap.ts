import pg from "pg";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createUser } from "../apps/api/src/auth";
import { migrate } from "../apps/api/src/db";
if (!process.env.DATABASE_URL) throw Error("Set DATABASE_URL first.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await migrate(pool);
if ((await pool.query("SELECT 1 FROM users")).rowCount) {
  await pool.end();
  throw Error(
    "A user already exists. Create additional users through Settings.",
  );
}
const rl = createInterface({ input: stdin, output: stdout });
const username = await rl.question("Manager username: ");
rl.close();
// Read password without terminal echo; no credential is logged or committed.
stdout.write("Manager password (12+ characters): ");
if (!stdin.isTTY) throw Error("Run bootstrap in an interactive terminal.");
stdin.setRawMode(true);
stdin.resume();
const password = await new Promise<string>((resolve) => {
  let value = "";
  function onData(chunk: Buffer) {
    for (const c of chunk.toString()) {
      if (c === "\u0003") process.exit(1);
      if (c === "\r" || c === "\n") {
        stdin.off("data", onData);
        stdin.setRawMode(false);
        stdin.pause();
        stdout.write("\n");
        resolve(value);
        return;
      }
      if (c === "\u007f") value = value.slice(0, -1);
      else value += c;
    }
  }
  stdin.on("data", onData);
});
try {
  await createUser(pool, username, password, "manager");
  console.log("Manager account created.");
} finally {
  await pool.end();
}
