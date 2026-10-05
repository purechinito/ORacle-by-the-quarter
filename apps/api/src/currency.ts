import { AppError } from "./db";

// Validate before request schemas discard unknown properties. Omitting a
// currency uses this application's PHP contract; an explicit label must match.
export function assertPesoCurrency(value: unknown): void {
  const pending: unknown[] = [value];
  while (pending.length) {
    const item = pending.pop();
    if (!item || typeof item !== "object") continue;
    for (const [name, child] of Object.entries(item)) {
      const field = name.toLowerCase().replace(/[_\s-]/g, "");
      if ((field === "currency" || field === "currencycode") && child !== "PHP")
        throw new AppError(
          400,
          "Only PHP currency is supported. No conversion was performed.",
        );
      if (child && typeof child === "object") pending.push(child);
    }
  }
}
