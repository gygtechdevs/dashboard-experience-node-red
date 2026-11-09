import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { LEGACY_REDIRECTS } from "./redirects";

describe("legacy redirects", () => {
  it("permanently redirects /review to /training/review", () => {
    expect(LEGACY_REDIRECTS).toContainEqual({ source: "/review", destination: "/training/review", permanent: true });
  });

  it("is registered in next.config", async () => {
    expect(await nextConfig.redirects?.()).toEqual(LEGACY_REDIRECTS);
  });

  it("only redirects the exact legacy path, so the query string is carried over by Next and the new route is untouched", () => {
    expect(LEGACY_REDIRECTS.map((r) => r.source)).toEqual(["/review"]);
    expect(LEGACY_REDIRECTS.some((r) => r.source.startsWith("/training"))).toBe(false);
  });
});
