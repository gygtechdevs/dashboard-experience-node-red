import { describe, expect, it } from "vitest";
import {
  MAX_INTENT_NAME_LENGTH,
  intentFormSchema,
  normalizeKeyword,
  addKeywords,
  MAX_TAGS,
  MAX_TAG_LENGTH,
} from "./schema";

const valid = { intent: "order status", initialStep: "/flows/orders", keywords: ["order"] };

describe("intentFormSchema", () => {
  it("accepts a valid payload and trims fields", () => {
    const result = intentFormSchema.safeParse({
      intent: "  order_status-2 ",
      initialStep: " /flows/orders ",
      keywords: [" order ", "status"],
      description: "  Where is my order  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        intent: "order_status-2",
        initialStep: "/flows/orders",
        keywords: ["order", "status"],
        tags: [],
        description: "Where is my order",
      });
    }
  });

  it("omits an empty description", () => {
    const result = intentFormSchema.parse({ ...valid, description: "   " });
    expect(result).not.toHaveProperty("description");
  });

  it.each(["", "   ", "bad/name", "emoji 😀", "dot.name", "a".repeat(MAX_INTENT_NAME_LENGTH + 1)])(
    "rejects intent name %j",
    (intent) => {
      const result = intentFormSchema.safeParse({ ...valid, intent });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0].path).toEqual(["intent"]);
    },
  );

  it("accepts a name at the maximum length", () => {
    expect(
      intentFormSchema.safeParse({ ...valid, intent: "a".repeat(MAX_INTENT_NAME_LENGTH) }).success,
    ).toBe(true);
  });

  it("requires initialStep", () => {
    const result = intentFormSchema.safeParse({ ...valid, initialStep: " " });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["initialStep"]);
  });

  it("requires at least one non-empty keyword", () => {
    for (const keywords of [[], ["", "  "]]) {
      const result = intentFormSchema.safeParse({ ...valid, keywords });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0].path).toEqual(["keywords"]);
    }
  });

  it("de-duplicates keywords case-insensitively, keeping the first spelling", () => {
    const result = intentFormSchema.parse({ ...valid, keywords: ["Order", "order", "ORDER ", "track"] });
    expect(result.keywords).toEqual(["Order", "track"]);
  });
});

describe("intentFormSchema tags", () => {
  it("defaults to an empty list", () => {
    expect(intentFormSchema.parse(valid).tags).toEqual([]);
  });

  it("trims, collapses spaces and de-duplicates case-insensitively keeping the first spelling", () => {
    const result = intentFormSchema.parse({ ...valid, tags: [" Sales ", "sales", "after  care", "Care-1"] });
    expect(result.tags).toEqual(["Sales", "after care", "Care-1"]);
  });

  it.each([
    ["special characters", ["sales!"]],
    ["leading dash", ["-sales"]],
    ["too long", ["a".repeat(MAX_TAG_LENGTH + 1)]],
    ["too many", Array.from({ length: MAX_TAGS + 1 }, (_v, i) => `t${i}`)],
  ])("rejects %s tags", (_label, tags) => {
    const result = intentFormSchema.safeParse({ ...valid, tags });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path[0]).toBe("tags");
  });

  it("drops blank tags like blank keywords", () => {
    expect(intentFormSchema.parse({ ...valid, tags: [" ", "ok"] }).tags).toEqual(["ok"]);
  });

  it("accepts the maximum length and count, including accents", () => {
    expect(intentFormSchema.safeParse({ ...valid, tags: ["a".repeat(MAX_TAG_LENGTH), "inversión"] }).success).toBe(true);
    expect(
      intentFormSchema.safeParse({ ...valid, tags: Array.from({ length: MAX_TAGS }, (_v, i) => `t${i}`) }).success,
    ).toBe(true);
  });
});

describe("normalizeKeyword", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normalizeKeyword("  where   is\tmy order ")).toBe("where is my order");
  });
});

describe("addKeywords", () => {
  it("adds new keywords, skipping blanks and duplicates", () => {
    expect(addKeywords(["order"], "Track, order , ,status")).toEqual(["order", "Track", "status"]);
  });

  it("returns the same list when nothing new is added", () => {
    expect(addKeywords(["a"], "  ,, ")).toEqual(["a"]);
  });
});
