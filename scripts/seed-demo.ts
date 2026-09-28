import type { Pool } from "pg";
import { transaction } from "../apps/api/src/db";
export async function seedDemo(pool: Pool, actor: string) {
  await transaction(pool, async (tx) => {
    const names = [
      "Oil filter",
      "Front brake pads",
      "Spark plug",
      "Air filter",
      "Drive belt",
      "Wheel bearing",
      "Fuel filter",
      "Wiper blade",
      "Radiator hose",
      "Tie rod end",
      "Cabin filter",
      "Brake disc",
    ];
    for (let i = 0; i < 60; i++) {
      const sku = "DEMO-" + String(i + 1).padStart(4, "0"),
        name =
          names[i % names.length] + " · Series " + (Math.floor(i / 12) + 1);
      const stock = i % 6 === 0 ? 0 : i % 5 === 0 ? 3 : 18 + (i % 31);
      const p = (
        await tx.query(
          "INSERT INTO parts(sku,name,brand,category,price,reorder,bin,aliases,search_key,stock) VALUES($1,$2,$3,$4,$5,5,$6,$7,$8,$9) RETURNING id",
          [
            sku,
            name,
            "Demo Parts Co.",
            [
              "Filtration",
              "Brakes",
              "Ignition",
              "Filtration",
              "Engine",
              "Drivetrain",
            ][i % 6],
            (8 + i * 1.25).toFixed(2),
            "A" +
              (1 + Math.floor(i / 12)) +
              "-" +
              String(1 + (i % 12)).padStart(2, "0"),
            JSON.stringify(["DEMOBC" + (10000 + i)]),
            (sku + name + "Demo Parts Co." + "DEMOBC" + (10000 + i))
              .toLowerCase()
              .replace(/[^a-z0-9]/g, ""),
            stock,
          ],
        )
      ).rows[0];
      if (stock)
        await tx.query(
          "INSERT INTO movements(part_id,qty,kind,reason,document_id,actor) VALUES($1,$2,'opening','Synthetic demo stock','demo-seed',$3)",
          [p.id, stock, actor],
        );
      await tx.query("INSERT INTO opening_parts VALUES($1)", [p.id]);
    }
    await tx.query(
      "INSERT INTO suppliers(name) VALUES('Demo Wholesale Supply')",
    );
  });
}
