import { describe, expect, it, vi } from "vitest";
import { GatewayError, createGatewayClient } from "./client";
import { bulkReviewResultSchema, impactSimulationSchema, unmatchedClustersSchema } from "./schemas";

const BASE = "http://gw.test";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function setup(response: Response) {
  const fetchImpl = vi.fn(async () => response);
  return { client: createGatewayClient({ baseUrl: BASE, token: "jwt-1", fetchImpl }), fetchImpl };
}

const call = (fetchImpl: ReturnType<typeof setup>["fetchImpl"]) =>
  fetchImpl.mock.calls[0] as unknown as [string, RequestInit];

const clusters = {
  method: "semantic",
  analyzed: 3,
  truncated: false,
  clusters: [
    {
      id: "abc123abc123",
      representativeText: "i want to reset my password",
      size: 7,
      memberIds: ["a", "b"],
      members: [
        { id: "a", maskedText: "i want to reset my password", occurrences: 5 },
        { id: "b", maskedText: "forgot my login secret", occurrences: 2 },
      ],
      nearestIntent: { intent: "password", similarity: 0.91 },
      firstSeenAt: "2026-03-01T00:00:00.000Z",
      lastSeenAt: "2026-03-09T00:00:00.000Z",
    },
  ],
};

const impact = {
  intent: "password",
  days: 30,
  selected: 2,
  scope: {
    exact: false,
    basis: "pending-messages-and-stored-examples",
    replayedMessages: 12,
    replayTruncated: false,
    examplesChecked: 40,
    examplesTruncated: false,
    minSimilarity: 0.8,
    ambiguityMargin: 0.05,
  },
  newlyMatched: {
    count: 4,
    selected: 2,
    others: 2,
    occurrences: 9,
    samples: [{ id: "a", maskedText: "cant login", similarity: 0.97, occurrences: 3, selected: false }],
  },
  ambiguous: 1,
  regressions: {
    count: 1,
    samples: [{ maskedText: "invoice question", from: "billing", similarity: 0.9, source: "keyword" }],
  },
};

describe("cluster schemas", () => {
  it("parses clusters with a nullable nearest intent", () => {
    const parsed = unmatchedClustersSchema.parse({
      ...clusters,
      clusters: [{ ...clusters.clusters[0], nearestIntent: null }],
    });
    expect(parsed.clusters[0]?.nearestIntent).toBeNull();
  });

  it("rejects an unknown method", () => {
    expect(unmatchedClustersSchema.safeParse({ ...clusters, method: "magic" }).success).toBe(false);
  });

  it("parses an impact simulation and keeps exact false", () => {
    expect(impactSimulationSchema.parse(impact).scope.exact).toBe(false);
    expect(impactSimulationSchema.safeParse({ ...impact, scope: { ...impact.scope, exact: true } }).success).toBe(false);
  });

  it("parses per-item bulk results, ok and failed", () => {
    const parsed = bulkReviewResultSchema.parse({
      intent: "password",
      succeeded: 1,
      failed: 1,
      results: [
        { id: "a", ok: true, embedded: true },
        { id: "b", ok: false, status: 409, error: "Unmatched message was already resolved" },
      ],
    });
    expect(parsed.results[1]).toMatchObject({ ok: false, status: 409 });
  });
});

describe("gateway client clusters", () => {
  it("listUnmatchedClusters GETs the clusters endpoint with the bearer token", async () => {
    const { client, fetchImpl } = setup(json(200, { ok: true, data: clusters }));
    const result = await client.listUnmatchedClusters();
    expect(result.method).toBe("semantic");
    expect(result.clusters).toHaveLength(1);
    const [url, init] = call(fetchImpl);
    expect(url).toBe(`${BASE}/api/admin/unmatched/clusters`);
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer jwt-1");
  });

  it("simulateClusterImpact POSTs intent, ids and days", async () => {
    const { client, fetchImpl } = setup(json(200, { ok: true, data: impact }));
    const result = await client.simulateClusterImpact({ intent: "password", ids: ["a", "b"], days: 14 });
    expect(result.newlyMatched.count).toBe(4);
    const [url, init] = call(fetchImpl);
    expect(url).toBe(`${BASE}/api/admin/unmatched/clusters/simulate`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ intent: "password", ids: ["a", "b"], days: 14 });
  });

  it("bulkApproveUnmatched and bulkRejectUnmatched POST their bodies", async () => {
    const body = { ok: true, data: { succeeded: 1, failed: 0, results: [{ id: "a", ok: true }] } };
    const approve = setup(json(200, body));
    await approve.client.bulkApproveUnmatched({ intent: "password", ids: ["a"] });
    expect(call(approve.fetchImpl)[0]).toBe(`${BASE}/api/admin/unmatched/bulk/approve`);
    expect(JSON.parse(call(approve.fetchImpl)[1].body as string)).toEqual({ intent: "password", ids: ["a"] });

    const reject = setup(json(200, body));
    await reject.client.bulkRejectUnmatched({ ids: ["a"] });
    expect(call(reject.fetchImpl)[0]).toBe(`${BASE}/api/admin/unmatched/bulk/reject`);
    expect(JSON.parse(call(reject.fetchImpl)[1].body as string)).toEqual({ ids: ["a"] });
  });

  it.each([
    [403, "forbidden"],
    [404, "not_found"],
    [503, "unavailable"],
  ])("maps status %i to %s", async (status, kind) => {
    const { client } = setup(json(status, { ok: false, error: "nope" }));
    await expect(client.listUnmatchedClusters()).rejects.toMatchObject({ kind, status });
  });

  it("rejects an unexpected body", async () => {
    const { client } = setup(json(200, { ok: true, data: { clusters: "x" } }));
    await expect(client.listUnmatchedClusters()).rejects.toBeInstanceOf(GatewayError);
  });
});
