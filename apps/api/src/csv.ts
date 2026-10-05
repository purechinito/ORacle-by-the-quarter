import { parse } from "csv-parse/sync";
import { AppError } from "./db";

export function parseImportCsv(csv: string): Record<string, string>[] {
  try {
    return parse(csv, {
      bom: true,
      skip_empty_lines: true,
      columns: (headers: string[]) => {
        const seen = new Set<string>();
        for (const header of headers) {
          const key = header.trim().toLowerCase();
          if (!key)
            throw new AppError(400, "CSV contains an empty column name.");
          if (seen.has(key))
            throw new AppError(
              400,
              "CSV contains a duplicate column: " +
                header +
                ". Use each column once.",
            );
          seen.add(key);
        }
        return headers;
      },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      400,
      "CSV could not be parsed. Check quotes and columns.",
    );
  }
}
