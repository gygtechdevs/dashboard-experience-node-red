import { beforeEach, describe, expect, it, vi } from "vitest";
import { GatewayError, type GatewayClient } from "@/lib/gateway/client";

const session = vi.hoisted(() => ({ value: { userId: "u", email: "e", permissions: ["ADMIN"], expiresAt: 1 } as unknown }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session.value }));

const client = vi.hoisted(() => ({
  simulateClusterImpact: vi.fn(),
  bulkApproveUnmatched: vi.fn(),
  bulkRejectUnmatched: vi.fn(),
}));
vi.mock("@/lib/gateway/server", () => ({
  withGateway: (operation: (c: unknown) => unknown) => operation(client as unknown as GatewayClient),
}));

import { bulkApproveUnmatchedAction, bulkRejectUnmatchedAction, simulateImpactAction } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  session.value = { userId: "u", email: "e", permissions: ["ADMIN"], expiresAt: 1 };
});

describe("simulateImpactAction", () => {
  it("passes the trimmed intent and ids to the gateway client", async () => {
    client.simulateClusterImpact.mockResolvedValue({ intent: "refund" });
    const result = await simulateImpactAction(" refund ", ["a", "b"]);
    expect(result).toEqual({ ok: true, data: { intent: "refund" } });
    expect(client.simulateClusterImpact).toHaveBeenCalledWith({ intent: "refund", ids: ["a", "b"] });
  });

  it("refuses non-admins without calling the gateway", async () => {
    session.value = { userId: "u", email: "e", permissions: ["WRITE"], expiresAt: 1 };
    expect(await simulateImpactAction("refund", ["a"])).toMatchObject({ ok: false, kind: "forbidden" });
    expect(client.simulateClusterImpact).not.toHaveBeenCalled();
  });

  it.each([
    ["", ["a"]],
    ["refund", []],
    ["refund", [""]],
    ["refund", Array.from({ length: 201 }, (_, i) => `id-${i}`)],
  ])("rejects invalid input %j %j", async (intent, ids) => {
    expect(await simulateImpactAction(intent, ids)).toMatchObject({ ok: false, kind: "error" });
    expect(client.simulateClusterImpact).not.toHaveBeenCalled();
  });

  it("maps a gateway 503 to the semantic-matching explanation", async () => {
    client.simulateClusterImpact.mockRejectedValue(new GatewayError("unavailable", 503, "x"));
    const result = await simulateImpactAction("refund", ["a"]);
    expect(result).toMatchObject({ ok: false, kind: "error" });
    expect(result.ok ? "" : result.message).toMatch(/coincidencia semántica/i);
  });
});

describe("bulkApproveUnmatchedAction", () => {
  it("returns the per-item result untouched", async () => {
    const data = { intent: "refund", succeeded: 1, failed: 1, results: [] };
    client.bulkApproveUnmatched.mockResolvedValue(data);
    expect(await bulkApproveUnmatchedAction("refund", ["a", "b"])).toEqual({ ok: true, data });
    expect(client.bulkApproveUnmatched).toHaveBeenCalledWith({ intent: "refund", ids: ["a", "b"] });
  });

  it("flags a 404 as stale so the UI refreshes", async () => {
    client.bulkApproveUnmatched.mockRejectedValue(new GatewayError("not_found", 404, "x"));
    expect(await bulkApproveUnmatchedAction("refund", ["a"])).toMatchObject({ ok: false, kind: "stale" });
  });

  it("requires an intent", async () => {
    expect(await bulkApproveUnmatchedAction("  ", ["a"])).toMatchObject({ ok: false, kind: "error" });
  });
});

describe("bulkRejectUnmatchedAction", () => {
  it("rejects the ids and refuses non-admins", async () => {
    client.bulkRejectUnmatched.mockResolvedValue({ succeeded: 2, failed: 0, results: [] });
    expect(await bulkRejectUnmatchedAction(["a", "b"])).toMatchObject({ ok: true });
    expect(client.bulkRejectUnmatched).toHaveBeenCalledWith({ ids: ["a", "b"] });

    session.value = null;
    expect(await bulkRejectUnmatchedAction(["a"])).toMatchObject({ ok: false, kind: "forbidden" });
  });
});
