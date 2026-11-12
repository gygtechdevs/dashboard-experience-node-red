import { describe, expect, it, vi } from "vitest";
import { GatewayError } from "@/lib/gateway/client";
import { createSettingsClient } from "./client";

const BASE = "http://settings.test/";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function setup(response: Response | Error) {
  const fetchImpl = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  const client = createSettingsClient({ baseUrl: BASE, apiKey: "key-1", fetchImpl });
  return { client, fetchImpl };
}

describe("settings client listSteps", () => {
  it("calls /api/steps with the api key and maps the registry to dashboard steps", async () => {
    const { client, fetchImpl } = setup(
      json(200, {
        count: 2,
        steps: [
          { id: "a1", name: "Orders", intent: "orders", path: "/stepin/orders" },
          { id: "b2", name: null, intent: "help", path: "/stepin/help" },
        ],
      }),
    );

    expect(await client.listSteps()).toEqual([
      { name: "Orders", path: "/stepin/orders" },
      { name: "help", path: "/stepin/help" },
    ]);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://settings.test/api/steps");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("key-1");
    expect(init.cache).toBe("no-store");
  });

  it("maps a network failure to an unavailable error", async () => {
    const { client } = setup(new Error("boom"));
    await expect(client.listSteps()).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("maps a non-2xx response to an unavailable error", async () => {
    const { client } = setup(json(502, { ok: false, message: "down" }));
    await expect(client.listSteps()).rejects.toBeInstanceOf(GatewayError);
    await expect(client.listSteps()).rejects.toMatchObject({ kind: "unavailable", status: 502 });
  });

  it("does not treat a settings 401 as a dashboard session expiry", async () => {
    const { client } = setup(json(401, { ok: false, message: "bad key" }));
    await expect(client.listSteps()).rejects.toMatchObject({ kind: "unavailable", status: 401 });
  });

  it("rejects a malformed registry payload", async () => {
    const { client } = setup(json(200, { count: 1, steps: [{ nope: true }] }));
    await expect(client.listSteps()).rejects.toMatchObject({ kind: "unexpected_response" });
  });
});
