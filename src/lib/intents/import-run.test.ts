import { describe, expect, it, vi } from "vitest";
import { GatewayError } from "@/lib/gateway/client";
import { runImport } from "./import-run";
import { MAX_IMPORT_ROWS } from "./import";

const row = (intent: string, extra: Record<string, unknown> = {}) => ({
  intent,
  initialStep: "/s",
  keywords: ["k"],
  tags: [],
  ...extra,
});

const describeError = (error: unknown) => (error instanceof Error ? error.message : "unknown");

function client(impl: (payload: { intent: string }) => Promise<void>) {
  return { createIntent: vi.fn(impl) };
}

describe("runImport", () => {
  it("creates rows sequentially, in order, and reports each one", async () => {
    const order: string[] = [];
    let running = 0;
    let maxRunning = 0;
    const gw = client(async ({ intent }) => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await Promise.resolve();
      order.push(intent);
      running -= 1;
    });
    const results = await runImport(gw, [row("a"), row("b"), row("c")], { describeError });
    expect(results).toEqual([
      { intent: "a", status: "created" },
      { intent: "b", status: "created" },
      { intent: "c", status: "created" },
    ]);
    expect(order).toEqual(["a", "b", "c"]);
    expect(maxRunning).toBe(1);
  });

  it("sends the parsed payload including tags", async () => {
    const gw = client(async () => undefined);
    await runImport(gw, [row("a", { tags: ["Sales"], description: "d" })], { describeError });
    expect(gw.createIntent).toHaveBeenCalledWith({
      intent: "a",
      initialStep: "/s",
      keywords: ["k"],
      tags: ["Sales"],
      description: "d",
    });
  });

  it("maps a 409 to duplicate and keeps going after per-row errors", async () => {
    const gw = client(async ({ intent }) => {
      if (intent === "dup") throw new GatewayError("conflict", 409, "Intent exists");
      if (intent === "bad") throw new GatewayError("validation", 400, "keywords invalid");
    });
    const results = await runImport(gw, [row("dup"), row("bad"), row("ok")], { describeError });
    expect(results).toEqual([
      { intent: "dup", status: "duplicate", message: "Intent exists" },
      { intent: "bad", status: "error", message: "keywords invalid" },
      { intent: "ok", status: "created" },
    ]);
  });

  it("re-validates rows server-side without calling the gateway for invalid ones", async () => {
    const gw = client(async () => undefined);
    const results = await runImport(gw, [row("bad/name"), row("ok")], { describeError });
    expect(results[0]).toMatchObject({ intent: "bad/name", status: "error" });
    expect(results[1]).toEqual({ intent: "ok", status: "created" });
    expect(gw.createIntent).toHaveBeenCalledTimes(1);
  });

  it("stops on forbidden or unavailable errors and skips the remaining rows", async () => {
    const gw = client(async ({ intent }) => {
      if (intent === "b") throw new GatewayError("forbidden", 403, "no");
    });
    const results = await runImport(gw, [row("a"), row("b"), row("c")], { describeError });
    expect(results.map((r) => r.status)).toEqual(["created", "error", "error"]);
    expect(results[2].message).toMatch(/omitida/i);
    expect(gw.createIntent).toHaveBeenCalledTimes(2);
  });

  it("rethrows unauthorized so the caller can redirect to login", async () => {
    const gw = client(async () => {
      throw new GatewayError("unauthorized", 401, "expired");
    });
    await expect(runImport(gw, [row("a")], { describeError })).rejects.toBeInstanceOf(GatewayError);
  });

  it("rejects non-array input and more rows than the cap", async () => {
    const gw = client(async () => undefined);
    await expect(runImport(gw, "nope", { describeError })).rejects.toThrow(/filas/i);
    await expect(
      runImport(gw, Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_v, i) => row(`i${i}`)), { describeError }),
    ).rejects.toThrow(String(MAX_IMPORT_ROWS));
    expect(gw.createIntent).not.toHaveBeenCalled();
  });
});
