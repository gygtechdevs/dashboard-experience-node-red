import { describe, expect, it, vi } from "vitest";
import { GatewayError, createGatewayClient } from "./client";
import {
  analyticsByChannelSchema,
  analyticsDailySchema,
  analyticsSummarySchema,
  analyticsTopTagsSchema,
} from "./schemas";

const BASE = "http://gw.test";
const QUERY = { from: "2026-05-01", to: "2026-05-31" };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function setup(response: Response | Error) {
  const fetchImpl = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  return { client: createGatewayClient({ baseUrl: BASE, token: "jwt-1", fetchImpl }), fetchImpl };
}

const urlOf = (fetchImpl: ReturnType<typeof setup>["fetchImpl"]) => (fetchImpl.mock.calls[0] as unknown as [string])[0];

const summary = {
  totalMessages: 10,
  uniqueConversations: 4,
  matchedRate: 0.7,
  errorRate: 0.1,
  previousPeriod: { totalMessages: 8, deltaPct: 25 },
};

describe("analytics schemas", () => {
  it("accepts a null deltaPct", () => {
    expect(
      analyticsSummarySchema.parse({ ...summary, previousPeriod: { totalMessages: 0, deltaPct: null } }).previousPeriod
        .deltaPct,
    ).toBeNull();
  });

  it("rejects a malformed summary", () => {
    expect(analyticsSummarySchema.safeParse({ ...summary, totalMessages: "10" }).success).toBe(false);
  });

  it("parses channel, tag and daily rows", () => {
    expect(analyticsByChannelSchema.parse([{ channel: "web", channelName: null, messages: 1, conversations: 1 }])).toHaveLength(1);
    expect(analyticsTopTagsSchema.parse([{ tag: "a", count: 2, pct: 50 }])).toHaveLength(1);
    expect(analyticsDailySchema.parse([{ date: "2026-05-01", byChannel: { whatsapp: 1, web: 0 }, total: 1 }])).toHaveLength(1);
  });
});

describe("gateway client analytics", () => {
  it("getAnalyticsSummary calls the proxy with the range, the channel and the bearer token", async () => {
    const { client, fetchImpl } = setup(json(200, { ok: true, data: summary }));
    expect(await client.getAnalyticsSummary({ ...QUERY, channel: "web" })).toEqual(summary);
    expect(urlOf(fetchImpl)).toBe(`${BASE}/api/admin/analytics/summary?from=2026-05-01&to=2026-05-31&channel=web`);
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer jwt-1");
    expect(init.cache).toBe("no-store");
  });

  it("omits the channel when it is not set", async () => {
    const { client, fetchImpl } = setup(json(200, { ok: true, data: summary }));
    await client.getAnalyticsSummary(QUERY);
    expect(urlOf(fetchImpl)).toBe(`${BASE}/api/admin/analytics/summary?from=2026-05-01&to=2026-05-31`);
  });

  it("getAnalyticsByChannel ignores the channel filter", async () => {
    const { client, fetchImpl } = setup(json(200, { ok: true, data: [] }));
    await client.getAnalyticsByChannel({ ...QUERY, channel: "web" });
    expect(urlOf(fetchImpl)).toBe(`${BASE}/api/admin/analytics/by-channel?from=2026-05-01&to=2026-05-31`);
  });

  it("getAnalyticsTopTags asks for the top 3", async () => {
    const { client, fetchImpl } = setup(json(200, { ok: true, data: [{ tag: "a", count: 1, pct: 10 }] }));
    expect(await client.getAnalyticsTopTags(QUERY)).toEqual([{ tag: "a", count: 1, pct: 10 }]);
    expect(urlOf(fetchImpl)).toContain("/api/admin/analytics/top-tags?");
    expect(urlOf(fetchImpl)).toContain("limit=3");
  });

  it("getAnalyticsDaily returns the daily rows", async () => {
    const rows = [{ date: "2026-05-01", byChannel: { whatsapp: 1 }, total: 1 }];
    const { client } = setup(json(200, { ok: true, data: rows }));
    expect(await client.getAnalyticsDaily(QUERY)).toEqual(rows);
  });

  it("maps a 400 to a validation error and a 503 to unavailable", async () => {
    const bad = (await setup(json(400, { ok: false, error: "date range must not exceed 366 days" }))
      .client.getAnalyticsSummary(QUERY)
      .catch((e: unknown) => e)) as GatewayError;
    expect(bad.kind).toBe("validation");
    const off = (await setup(json(503, { ok: false, error: "Analytics unavailable" }))
      .client.getAnalyticsSummary(QUERY)
      .catch((e: unknown) => e)) as GatewayError;
    expect(off.kind).toBe("unavailable");
  });

  it("maps an unexpected body to unexpected_response", async () => {
    const error = (await setup(json(200, { ok: true, data: { nope: 1 } }))
      .client.getAnalyticsSummary(QUERY)
      .catch((e: unknown) => e)) as GatewayError;
    expect(error.kind).toBe("unexpected_response");
  });
});
