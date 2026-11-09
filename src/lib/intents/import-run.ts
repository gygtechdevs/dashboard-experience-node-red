import { GatewayError, type GatewayClient } from "@/lib/gateway/client";
import { MAX_IMPORT_ROWS } from "./import";
import { intentFormSchema } from "./schema";

export interface ImportRowResult {
  intent: string;
  status: "created" | "duplicate" | "error";
  message?: string;
}

/** The payload itself is unusable (not a list, over the cap), as opposed to a row-level failure. */
export class ImportInputError extends Error {}

interface RunImportOptions {
  /** Turns an unexpected error into a user-facing message. */
  describeError: (error: unknown) => string;
}

const labelOf = (row: unknown): string =>
  row !== null && typeof row === "object" && typeof (row as { intent?: unknown }).intent === "string"
    ? (row as { intent: string }).intent
    : "";

/**
 * Creates the rows one by one through the existing create endpoint (no bulk
 * endpoint in the backend). A duplicate (409) or a single bad row never aborts
 * the batch; forbidden/unavailable do, because every following call would fail
 * the same way. Unauthorized is rethrown so the caller can redirect to login.
 */
export async function runImport(
  client: Pick<GatewayClient, "createIntent">,
  rows: unknown,
  { describeError }: RunImportOptions,
): Promise<ImportRowResult[]> {
  if (!Array.isArray(rows)) throw new ImportInputError("Se esperaba una lista de filas para importar.");
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ImportInputError(`Se pueden importar como máximo ${MAX_IMPORT_ROWS} filas a la vez.`);
  }

  const results: ImportRowResult[] = [];
  let abortMessage: string | null = null;

  for (const row of rows as unknown[]) {
    const intent = labelOf(row);
    if (abortMessage !== null) {
      results.push({ intent, status: "error", message: `Omitida: ${abortMessage}` });
      continue;
    }

    const parsed = intentFormSchema.safeParse(row);
    if (!parsed.success) {
      results.push({ intent, status: "error", message: parsed.error.issues[0]?.message ?? "Fila no válida." });
      continue;
    }

    try {
      await client.createIntent(parsed.data);
      results.push({ intent: parsed.data.intent, status: "created" });
    } catch (error) {
      if (error instanceof GatewayError) {
        if (error.kind === "unauthorized") throw error;
        if (error.kind === "conflict") {
          results.push({ intent: parsed.data.intent, status: "duplicate", message: error.message });
          continue;
        }
        const message = describeError(error);
        results.push({ intent: parsed.data.intent, status: "error", message });
        if (error.kind === "forbidden" || error.kind === "unavailable") abortMessage = message;
        continue;
      }
      results.push({ intent: parsed.data.intent, status: "error", message: describeError(error) });
    }
  }
  return results;
}
