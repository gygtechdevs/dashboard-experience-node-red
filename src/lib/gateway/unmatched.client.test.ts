import { describe, expect, it, vi } from "vitest";
import { GatewayError, createGatewayClient } from "./client";
import { approveUnmatchedResultSchema, unmatchedPageSchema } from "./schemas";

const BASE = "http://gw.test";

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

const call = (fetchImpl: ReturnType<typeof setup>["fetchImpl"]) =>
  fetchImpl.mock.calls[0] as unknown as [string, RequestInit];

const item = {
  id: "u1",
  maskedText: "i want [EMAIL]",
  occurrences: 3,
  status: "pending",
  firstSeenAt: "2026-05-01T10:00:00.000Z",
  lastSeenAt: "2026-05-02T10:00:00.000Z",
  resolvedIntent: null,
  resolvedBy: null,
  resolvedAt: null,
};

describe("unmatched schemas", () => {
  it("parses a page with a null cursor", () => {
    expect(unmatchedPageSchema.parse({ items: [item], nextCursor: null }).items).toHaveLength(1);
  });

  it("rejects an item with a bad status", () => {
    expect(unmatchedPageSchema.safeParse({ items: [{ ...item, status: "weird" }], nextCursor: null }).success).toBe(false);
  });

  it("parses an approve result", () => {
    expect(approveUnmatchedResultSchema.parse({ id: "u1", status: "approved", intent: "refund", embedded: false }).embedded).toBe(false);
  });
});

describe("gateway client unmatched", () => {
  it("listUnmatched sends only the provided params with the bearer token", async () => {
    const { client, fetchImpl } = setup(json(200, { ok: true, data: { items: [item], nextCursor: "c2" } }));
    const page = await client.listUnmatched({ status: "approved", limit: 20, cursor: "c1" });
    expect(page.nextCursor).toBe("c2");
    const [url, init] = call(fetchImpl);
    expect(url).toBe(`${BASE}/api/admin/unmatched?status=approved&limit=20&cursor=c1`);
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer jwt-1");
  });

  it("listUnmatched without params has no query string", async () => {
    const { client, fetchImpl } = setup(json(200, { ok: true, data: { items: [], nextCursor: null } }));
    await client.listUnmatched({});
    expect(call(fetchImpl)[0]).toBe(`${BASE}/api/admin/unmatched`);
  });

  it("approveUnmatched POSTs the intent to the encoded id", async () => {
    const { client, fetchImpl } = setup(json(200, { ok: true, data: { id: "a/b", status: "approved", intent: "refund", embedded: true } }));
    expect(await client.approveUnmatched("a/b", "refund")).toEqual({ id: "a/b", status: "approved", intent: "refund", embedded: true });
    const [url, init] = call(fetchImpl);
    expect(url).toBe(`${BASE}/api/admin/unmatched/a%2Fb/approve`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ intent: "refund" });
  });

  it("rejectUnmatched POSTs to the reject endpoint", async () => {
    const { client, fetchImpl } = setup(json(200, { ok: true, data: { id: "u1", status: "rejected" } }));
    await client.rejectUnmatched("u1");
    expect(call(fetchImpl)[0]).toBe(`${BASE}/api/admin/unmatched/u1/reject`);
    expect(call(fetchImpl)[1].method).toBe("POST");
  });

  it.each([
    [403, "forbidden"],
    [404, "not_found"],
    [409, "conflict"],
    [503, "unavailable"],
  ])("maps status %i to %s", async (status, kind) => {
    const { client } = setup(json(status, { ok: false, error: "nope" }));
    await expect(client.rejectUnmatched("u1")).rejects.toMatchObject({ kind, status });
  });

  it("rejects an unexpected body", async () => {
    const { client } = setup(json(200, { ok: true, data: { items: "x" } }));
    await expect(client.listUnmatched({})).rejects.toBeInstanceOf(GatewayError);
  });
});
