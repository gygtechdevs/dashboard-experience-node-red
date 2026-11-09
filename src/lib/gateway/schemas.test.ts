import { describe, expect, it } from "vitest";
import { intentsResponseSchema, stepsResponseSchema, okResponseSchema } from "./schemas";

describe("intentsResponseSchema", () => {
  it("parses the gateway listing and keeps optional description", () => {
    const parsed = intentsResponseSchema.parse({
      ok: true,
      intents: [
        { intent: "a", initialStep: "/a", keywords: ["x"] },
        { intent: "b", initialStep: "/b", keywords: [], description: "desc" },
      ],
    });
    expect(parsed.intents[1].description).toBe("desc");
    expect(parsed.intents[0].description).toBeUndefined();
  });

  it("keeps tags and defaults to an empty list for an older gateway", () => {
    const parsed = intentsResponseSchema.parse({
      ok: true,
      intents: [
        { intent: "a", initialStep: "/a", keywords: [], tags: ["sales"] },
        { intent: "b", initialStep: "/b", keywords: [] },
      ],
    });
    expect(parsed.intents.map((i) => i.tags)).toEqual([["sales"], []]);
  });

  it("rejects an entry without initialStep", () => {
    expect(
      intentsResponseSchema.safeParse({ ok: true, intents: [{ intent: "a", keywords: [] }] }).success,
    ).toBe(false);
  });
});

describe("stepsResponseSchema", () => {
  it("parses {ok, steps:[{name, path}]}", () => {
    const parsed = stepsResponseSchema.parse({ ok: true, steps: [{ name: "Orders", path: "/orders" }] });
    expect(parsed.steps).toEqual([{ name: "Orders", path: "/orders" }]);
  });
});

describe("okResponseSchema", () => {
  it("accepts extra fields such as the created intent", () => {
    expect(okResponseSchema.safeParse({ ok: true, intent: { intent: "a" } }).success).toBe(true);
  });
});
