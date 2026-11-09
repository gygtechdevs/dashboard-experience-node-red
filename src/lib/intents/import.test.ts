import { describe, expect, it } from "vitest";
import {
  IMPORT_TEMPLATE_CSV,
  IMPORT_TEMPLATE_JSON,
  MAX_IMPORT_ROWS,
  detectImportFormat,
  parseCsv,
  parseImportText,
  summarizeChecks,
  validateImportRows,
} from "./import";

function rowsOf(text: string, format: "csv" | "json" = "csv") {
  const parsed = parseImportText(text, format);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.rows;
}

describe("detectImportFormat", () => {
  it.each([
    ["intents.csv", "csv"],
    ["INTENTS.JSON", "json"],
    ["intents.txt", null],
    ["intents", null],
  ] as const)("%s -> %s", (name, expected) => {
    expect(detectImportFormat(name)).toBe(expected);
  });
});

describe("parseCsv", () => {
  it("splits records and cells, handling CRLF and a trailing newline", () => {
    expect(parseCsv("a,b\r\nc,d\r\n", ",")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("supports quoted cells with delimiters, escaped quotes and newlines", () => {
    expect(parseCsv('a,"b,1","say ""hi""","line1\nline2"', ",")).toEqual([["a", "b,1", 'say "hi"', "line1\nline2"]]);
  });

  it("keeps empty cells and drops fully blank records", () => {
    expect(parseCsv("a,,c\n\n,,\nd,e,f", ",")).toEqual([
      ["a", "", "c"],
      ["d", "e", "f"],
    ]);
  });
});

describe("parseImportText (CSV)", () => {
  const header = "intent,initialStep,keywords,description,tags";

  it("maps columns by header, splits keywords and tags on | and ignores unknown columns", () => {
    const rows = rowsOf(`${header},extra\norder,/orders,track|where is my order,Where is it,logistics|support,x`);
    expect(rows).toEqual([
      {
        index: 1,
        data: {
          intent: "order",
          initialStep: "/orders",
          keywords: ["track", "where is my order"],
          description: "Where is it",
          tags: ["logistics", "support"],
        },
      },
    ]);
  });

  it("is case-insensitive on headers, tolerates a BOM and a semicolon delimiter", () => {
    const rows = rowsOf("﻿Intent;InitialStep;Keywords\nrefund;/refunds;money back|refund");
    expect(rows[0].data).toMatchObject({ intent: "refund", initialStep: "/refunds", keywords: ["money back", "refund"] });
  });

  it("treats description and tags as optional columns", () => {
    const rows = rowsOf("intent,initialStep,keywords\na,/a,k");
    expect(rows[0].data).toEqual({ intent: "a", initialStep: "/a", keywords: ["k"], description: "", tags: [] });
  });

  it.each([
    ["missing initialStep", "intent,keywords\na,k", /initialStep/],
    ["missing keywords", "intent,initialStep\na,/a", /keywords/],
    ["missing intent", "initialStep,keywords\n/a,k", /intent/],
  ])("fails when the header is incomplete: %s", (_label, text, message) => {
    const parsed = parseImportText(text, "csv");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(message);
  });

  it("fails for an empty file or a file with only a header", () => {
    expect(parseImportText("", "csv").ok).toBe(false);
    expect(parseImportText(`${header}\n`, "csv")).toMatchObject({ ok: false, error: expect.stringMatching(/no tiene filas/i) });
  });

  it("numbers rows from 1 in file order", () => {
    const rows = rowsOf(`${header}\na,/a,k,,\n\nb,/b,k,,`);
    expect(rows.map((r) => r.index)).toEqual([1, 2]);
  });
});

describe("parseImportText (JSON)", () => {
  it("reads an array of objects, accepting arrays or | strings for lists", () => {
    const rows = rowsOf(
      JSON.stringify([
        { intent: "a", initialStep: "/a", keywords: ["x", "y"], tags: ["t"] },
        { intent: "b", initialStep: "/b", keywords: "x|y", tags: "t1|t2", description: "d" },
      ]),
      "json",
    );
    expect(rows[0].data).toMatchObject({ keywords: ["x", "y"], tags: ["t"], description: "" });
    expect(rows[1].data).toMatchObject({ keywords: ["x", "y"], tags: ["t1", "t2"], description: "d" });
  });

  it.each([
    ["invalid JSON", "{nope", /no es un JSON válido/i],
    ["a non-array root", '{"intent":"a"}', /arreglo/i],
    ["an empty array", "[]", /no tiene filas/i],
  ])("fails for %s", (_label, text, message) => {
    const parsed = parseImportText(text, "json");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(message);
  });

  it("keeps non-object entries as null so they fail validation per row", () => {
    const rows = rowsOf(JSON.stringify([1, { intent: "a", initialStep: "/a", keywords: ["k"] }]), "json");
    expect(rows[0].data).toBeNull();
    expect(validateImportRows(rows)[0]).toMatchObject({ status: "invalid", errors: { intent: expect.any(String) } });
  });
});

describe("row cap", () => {
  it("accepts exactly the maximum and rejects more", () => {
    const make = (n: number) =>
      "intent,initialStep,keywords\n" + Array.from({ length: n }, (_v, i) => `i${i},/s,k`).join("\n");
    expect(parseImportText(make(MAX_IMPORT_ROWS), "csv").ok).toBe(true);
    const over = parseImportText(make(MAX_IMPORT_ROWS + 1), "csv");
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toContain(String(MAX_IMPORT_ROWS));
  });
});

describe("validateImportRows", () => {
  it("validates every row with the intent form schema", () => {
    const checks = validateImportRows(
      rowsOf(
        [
          "intent,initialStep,keywords,description,tags",
          "ok one,/a,k1|K1|k2,  desc ,Sales|sales",
          "bad/name,/a,k,,",
          "no step,,k,,",
          "no keywords,/a,,,",
          "bad tag,/a,k,,sales!",
        ].join("\n"),
      ),
    );
    expect(checks[0]).toEqual({
      index: 1,
      intent: "ok one",
      status: "valid",
      values: { intent: "ok one", initialStep: "/a", keywords: ["k1", "k2"], tags: ["Sales"], description: "desc" },
    });
    expect(checks[1]).toMatchObject({ status: "invalid", errors: { intent: expect.any(String) } });
    expect(checks[2]).toMatchObject({ status: "invalid", errors: { initialStep: expect.any(String) } });
    expect(checks[3]).toMatchObject({ status: "invalid", errors: { keywords: expect.any(String) } });
    expect(checks[4]).toMatchObject({ status: "invalid", errors: { tags: expect.any(String) } });
  });

  it("flags a repeated intent name inside the file, keeping the first occurrence valid", () => {
    const checks = validateImportRows(rowsOf("intent,initialStep,keywords\na,/a,k\nb,/b,k\na,/c,k"));
    expect(checks.map((c) => c.status)).toEqual(["valid", "valid", "invalid"]);
    expect(checks[2]).toMatchObject({ errors: { intent: expect.stringContaining("fila 1") } });
  });

  it("rejects non-string list items from JSON", () => {
    const checks = validateImportRows(
      rowsOf(JSON.stringify([{ intent: "a", initialStep: "/a", keywords: [1] }]), "json"),
    );
    expect(checks[0]).toMatchObject({ status: "invalid", errors: { keywords: expect.any(String) } });
  });

  it("summarizes valid and invalid counts", () => {
    const checks = validateImportRows(rowsOf("intent,initialStep,keywords\na,/a,k\n,/b,k"));
    expect(summarizeChecks(checks)).toEqual({ total: 2, valid: 1, invalid: 1 });
  });
});

describe("templates", () => {
  it.each([
    ["csv", IMPORT_TEMPLATE_CSV],
    ["json", IMPORT_TEMPLATE_JSON],
  ] as const)("the %s template parses and validates cleanly", (format, text) => {
    const checks = validateImportRows(rowsOf(text, format));
    expect(checks.length).toBeGreaterThan(0);
    expect(checks.every((c) => c.status === "valid")).toBe(true);
  });
});
