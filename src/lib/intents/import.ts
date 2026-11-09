import { intentFormSchema, zodFieldErrors, type FieldErrors, type IntentFormValues } from "./schema";

/**
 * Bulk import of intents from CSV or JSON. Everything here is pure (no I/O) so
 * it can run in the browser for the preview and be unit tested.
 *
 * CSV: header row with the columns `intent,initialStep,keywords,description,tags`
 * (`description` and `tags` are optional, column order is free, headers are
 * case-insensitive). `keywords` and `tags` hold several values separated by `|`.
 * Comma or semicolon delimiters are accepted.
 *
 * JSON: an array of objects with the same keys. `keywords` and `tags` may be
 * arrays of strings or a `|`-separated string.
 */
export const MAX_IMPORT_ROWS = 200;
/** Rows sent per Server Action call, so a long import reports progress and stays under request limits. */
export const IMPORT_BATCH_SIZE = 25;
export const LIST_SEPARATOR = "|";

export type ImportFormat = "csv" | "json";

/** Raw, not yet validated, values of one row. */
export interface ImportRowData {
  intent: unknown;
  initialStep: unknown;
  keywords: unknown;
  description: unknown;
  tags: unknown;
}

export interface ImportRow {
  /** 1-based position among the data rows of the file. */
  index: number;
  /** Null when the entry is not an object (JSON only). */
  data: ImportRowData | null;
}

export type ParseResult = { ok: true; rows: ImportRow[] } | { ok: false; error: string };

export type ImportCheck =
  | { index: number; intent: string; status: "valid"; values: IntentFormValues }
  | { index: number; intent: string; status: "invalid"; errors: FieldErrors };

export function detectImportFormat(filename: string): ImportFormat | null {
  if (!filename.includes(".")) return null;
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "csv") return "csv";
  if (extension === "json") return "json";
  return null;
}

/** Minimal RFC 4180 parser: quoted cells, escaped quotes, embedded delimiters/newlines. Blank records are dropped. */
export function parseCsv(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;

  const endCell = () => {
    record.push(cell);
    cell = "";
  };
  const endRecord = () => {
    endCell();
    if (record.some((value) => value.trim() !== "")) records.push(record);
    record = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === delimiter) {
      endCell();
    } else if (char === "\n") {
      endRecord();
    } else if (char === "\r") {
      if (text[i + 1] === "\n") i += 1;
      endRecord();
    } else {
      cell += char;
    }
  }
  if (cell !== "" || record.length > 0) endRecord();
  return records;
}

function splitList(cell: string): string[] {
  return cell
    .split(LIST_SEPARATOR)
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

const COLUMNS: Record<string, string> = {
  intent: "intent",
  initialstep: "initialStep",
  keywords: "keywords",
  description: "description",
  tags: "tags",
};
const REQUIRED_COLUMNS = ["intent", "initialStep", "keywords"] as const;

function tooManyRows(count: number): string {
  return `El archivo tiene ${count} filas; el máximo es ${MAX_IMPORT_ROWS} por importación.`;
}

function parseCsvRows(text: string): ParseResult {
  const content = text.replace(/^﻿/, "");
  const firstLine = content.split(/\r?\n/, 1)[0] ?? "";
  const commas = firstLine.split(",").length - 1;
  const semicolons = firstLine.split(";").length - 1;
  const records = parseCsv(content, semicolons > commas ? ";" : ",");

  const header = records[0];
  if (!header) return { ok: false, error: "El archivo está vacío." };

  const columnIndex = new Map<string, number>();
  header.forEach((name, position) => {
    const canonical = COLUMNS[name.trim().toLowerCase()];
    if (canonical && !columnIndex.has(canonical)) columnIndex.set(canonical, position);
  });
  const missing = REQUIRED_COLUMNS.filter((name) => !columnIndex.has(name));
  if (missing.length > 0) {
    return { ok: false, error: `Faltan columnas obligatorias: ${missing.join(", ")}.` };
  }

  const dataRecords = records.slice(1);
  if (dataRecords.length === 0) return { ok: false, error: "El archivo no tiene filas para importar." };
  if (dataRecords.length > MAX_IMPORT_ROWS) return { ok: false, error: tooManyRows(dataRecords.length) };

  const cellOf = (record: string[], column: string) => {
    const position = columnIndex.get(column);
    return position === undefined ? "" : (record[position] ?? "").trim();
  };
  return {
    ok: true,
    rows: dataRecords.map((record, position) => ({
      index: position + 1,
      data: {
        intent: cellOf(record, "intent"),
        initialStep: cellOf(record, "initialStep"),
        keywords: splitList(cellOf(record, "keywords")),
        description: cellOf(record, "description"),
        tags: splitList(cellOf(record, "tags")),
      },
    })),
  };
}

function listFromJson(value: unknown): unknown {
  if (value === undefined || value === null) return [];
  return typeof value === "string" ? splitList(value) : value;
}

function parseJsonRows(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    return { ok: false, error: "El archivo no es un JSON válido." };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: "El archivo JSON debe contener un arreglo de objetos de intención." };
  }
  if (parsed.length === 0) return { ok: false, error: "El archivo no tiene filas para importar." };
  if (parsed.length > MAX_IMPORT_ROWS) return { ok: false, error: tooManyRows(parsed.length) };

  return {
    ok: true,
    rows: parsed.map((entry: unknown, position): ImportRow => {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
        return { index: position + 1, data: null };
      }
      const record = entry as Record<string, unknown>;
      return {
        index: position + 1,
        data: {
          intent: record.intent,
          initialStep: record.initialStep,
          keywords: listFromJson(record.keywords),
          description: record.description ?? "",
          tags: listFromJson(record.tags),
        },
      };
    }),
  };
}

export function parseImportText(text: string, format: ImportFormat): ParseResult {
  return format === "csv" ? parseCsvRows(text) : parseJsonRows(text);
}

/** Validates every row with the same schema as the intent form and flags repeated names inside the file. */
export function validateImportRows(rows: ImportRow[]): ImportCheck[] {
  const firstSeen = new Map<string, number>();
  return rows.map(({ index, data }): ImportCheck => {
    if (data === null) {
      return { index, intent: "", status: "invalid", errors: { intent: "Cada fila debe ser un objeto." } };
    }
    const label = typeof data.intent === "string" ? data.intent.trim() : "";
    const result = intentFormSchema.safeParse(data);
    if (!result.success) {
      return { index, intent: label, status: "invalid", errors: zodFieldErrors(result.error) };
    }
    const earlier = firstSeen.get(result.data.intent);
    if (earlier !== undefined) {
      return {
        index,
        intent: label,
        status: "invalid",
        errors: { intent: `Duplicada de la fila ${earlier} de este archivo.` },
      };
    }
    firstSeen.set(result.data.intent, index);
    return { index, intent: result.data.intent, status: "valid", values: result.data };
  });
}

export function summarizeChecks(checks: ImportCheck[]): { total: number; valid: number; invalid: number } {
  const valid = checks.filter((check) => check.status === "valid").length;
  return { total: checks.length, valid, invalid: checks.length - valid };
}

export const IMPORT_TEMPLATE_CSV = [
  "intent,initialStep,keywords,description,tags",
  "order_status,/stepin/orders,seguimiento|dónde está mi pedido,¿Dónde está mi pedido?,logistica|soporte",
  'refund,/stepin/refunds,reembolso|devolución de dinero,"Solicitudes de reembolso y devoluciones",facturacion',
  "",
].join("\n");

export const IMPORT_TEMPLATE_JSON = `${JSON.stringify(
  [
    {
      intent: "order_status",
      initialStep: "/stepin/orders",
      keywords: ["seguimiento", "dónde está mi pedido"],
      description: "¿Dónde está mi pedido?",
      tags: ["logistica", "soporte"],
    },
    {
      intent: "refund",
      initialStep: "/stepin/refunds",
      keywords: ["reembolso", "devolución de dinero"],
      description: "Solicitudes de reembolso y devoluciones",
      tags: ["facturacion"],
    },
  ],
  null,
  2,
)}\n`;
