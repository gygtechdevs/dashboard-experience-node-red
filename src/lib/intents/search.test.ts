import { describe, expect, it } from "vitest";
import { collectTags, filterIntents } from "./search";
import type { Intent } from "@/lib/gateway/schemas";

const intents: Intent[] = [
  { intent: "Order Status", initialStep: "/orders", keywords: ["track", "package"], tags: ["Logistics", "support"] },
  { intent: "refund", initialStep: "/refunds", keywords: ["money back", "Réfund"], description: "Returns", tags: ["Support"] },
  { intent: "greeting", initialStep: "/hello", keywords: ["hi"], tags: [] },
];

describe("filterIntents", () => {
  it("returns everything for an empty or blank query", () => {
    expect(filterIntents(intents, "")).toEqual(intents);
    expect(filterIntents(intents, "   ")).toEqual(intents);
  });

  it("matches the intent name case-insensitively", () => {
    expect(filterIntents(intents, "ORDER").map((i) => i.intent)).toEqual(["Order Status"]);
  });

  it("matches keywords", () => {
    expect(filterIntents(intents, "money").map((i) => i.intent)).toEqual(["refund"]);
  });

  it("ignores accents", () => {
    expect(filterIntents(intents, "refund").map((i) => i.intent)).toEqual(["refund"]);
    expect(filterIntents(intents, "réfund").map((i) => i.intent)).toEqual(["refund"]);
  });

  it("matches the description", () => {
    expect(filterIntents(intents, "returns").map((i) => i.intent)).toEqual(["refund"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterIntents(intents, "zzz")).toEqual([]);
  });

  it("matches tags in the text search", () => {
    expect(filterIntents(intents, "logist").map((i) => i.intent)).toEqual(["Order Status"]);
  });

  it("filters by tag case-insensitively and combines with the query", () => {
    expect(filterIntents(intents, "", "SUPPORT").map((i) => i.intent)).toEqual(["Order Status", "refund"]);
    expect(filterIntents(intents, "money", "support").map((i) => i.intent)).toEqual(["refund"]);
    expect(filterIntents(intents, "hi", "support")).toEqual([]);
    expect(filterIntents(intents, "", "")).toEqual(intents);
  });
});

describe("collectTags", () => {
  it("returns distinct tags case-insensitively (first spelling), sorted", () => {
    expect(collectTags(intents)).toEqual(["Logistics", "support"]);
  });

  it("returns an empty list when nothing is tagged", () => {
    expect(collectTags([])).toEqual([]);
  });
});
