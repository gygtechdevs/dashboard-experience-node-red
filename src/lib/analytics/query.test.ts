import { describe, expect, it } from "vitest";
import { buildAnalyticsHref, parseAnalyticsParams, presetRange } from "./query";

const TODAY = new Date("2026-05-31T15:00:00.000Z");

describe("parseAnalyticsParams", () => {
  it("defaults to the last 30 UTC days and all channels", () => {
    expect(parseAnalyticsParams({}, TODAY)).toEqual({ from: "2026-05-02", to: "2026-05-31", channel: undefined });
  });

  it("keeps valid params", () => {
    expect(parseAnalyticsParams({ from: "2026-05-10", to: "2026-05-20", channel: "web" }, TODAY)).toEqual({
      from: "2026-05-10",
      to: "2026-05-20",
      channel: "web",
    });
  });

  it("takes the first value of repeated params", () => {
    expect(parseAnalyticsParams({ from: ["2026-05-10", "2026-05-11"], to: "2026-05-20" }, TODAY).from).toBe("2026-05-10");
  });

  it.each([
    [{ from: "nope", to: "2026-05-20" }, "malformed from"],
    [{ from: "2026-02-31", to: "2026-05-20" }, "impossible date"],
    [{ from: "2026-05-20", to: "2026-05-10" }, "from after to"],
    [{ from: "2020-01-01", to: "2026-05-10" }, "range over 366 days"],
  ])("falls back to the default range for %j (%s)", (params) => {
    const result = parseAnalyticsParams(params, TODAY);
    expect(result.from).toBe("2026-05-02");
    expect(result.to).toBe("2026-05-31");
  });

  it("only from: ends today; only to: starts 29 days before", () => {
    expect(parseAnalyticsParams({ from: "2026-05-25" }, TODAY)).toMatchObject({ from: "2026-05-25", to: "2026-05-31" });
    expect(parseAnalyticsParams({ to: "2026-05-10" }, TODAY)).toMatchObject({ from: "2026-04-11", to: "2026-05-10" });
  });

  it("drops an invalid channel", () => {
    expect(parseAnalyticsParams({ channel: "Bad Channel!" }, TODAY).channel).toBeUndefined();
    expect(parseAnalyticsParams({ channel: "" }, TODAY).channel).toBeUndefined();
  });
});

describe("presetRange / buildAnalyticsHref", () => {
  it("builds N-day presets ending today (inclusive)", () => {
    expect(presetRange(7, TODAY)).toEqual({ from: "2026-05-25", to: "2026-05-31" });
    expect(presetRange(90, TODAY)).toEqual({ from: "2026-03-03", to: "2026-05-31" });
  });

  it("builds a href that keeps the channel only when set", () => {
    expect(buildAnalyticsHref({ from: "2026-05-01", to: "2026-05-31", channel: "web" })).toBe(
      "/analytics?from=2026-05-01&to=2026-05-31&channel=web",
    );
    expect(buildAnalyticsHref({ from: "2026-05-01", to: "2026-05-31" })).toBe("/analytics?from=2026-05-01&to=2026-05-31");
  });
});
