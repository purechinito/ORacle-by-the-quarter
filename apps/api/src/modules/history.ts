import { z } from "zod";
import { AppError } from "../db";
export const historyQuery = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(200).default(""),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export function checkDates(q: { from?: string; to?: string }) {
  if (q.from && q.to && q.from > q.to)
    throw new AppError(400, "Start date must precede end date.");
}
