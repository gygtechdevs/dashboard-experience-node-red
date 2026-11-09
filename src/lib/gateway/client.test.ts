import { describe, expect, it, vi } from "vitest";
import { GatewayError, createGatewayClient, inferFieldErrors } from "./client";

const BASE = "http://gw.test";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setup(response: Response | Error) {
  const fetchImpl = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  const client = createGatewayClient({ baseUrl: BASE, token: "jwt-123", fetchImpl });
  return { client, fetchImpl };
}

function lastCall(fetchImpl: ReturnType<typeof setup>["fetchImpl"]) {
  return fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
}

describe("gateway client requests", () => {
  it("lists intents with the bearer token and no caching", async () => {
    const { client, fetchImpl } = setup(
      json(200, { ok: true, intents: [{ intent: "a", initialStep: "/a", keywords: ["k"] }] }),
    );
    const intents = await client.listIntents();
    expect(intents).toEqual([{ intent: "a", initialStep: "/a", keywords: ["k"], tags: [] }]);
    const [url, init] = lastCall(fetchImpl);
    expect(url).toBe("http://gw.test/api/admin/intents");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer jwt-123");
    expect(init.cache).toBe("no-store");
  });

  it("lists steps", async () => {
    const { client } = setup(json(200, { ok: true, steps: [{ name: "O", path: "/o" }] }));
    expect(await client.listSteps()).toEqual([{ name: "O", path: "/o" }]);
  });

  it("creates an intent with a JSON body", async () => {
    const { client, fetchImpl } = setup(json(201, { ok: true }));
    await client.createIntent({ intent: "a", initialStep: "/a", keywords: ["k"] });
    const [url, init] = lastCall(fetchImpl);
    expect(url).toBe("http://gw.test/api/admin/intents");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ intent: "a", initialStep: "/a", keywords: ["k"] });
  });

  it("sends tags on create and update", async () => {
    const created = setup(json(201, { ok: true }));
    await created.client.createIntent({ intent: "a", initialStep: "/a", keywords: ["k"], tags: ["sales"] });
    expect(JSON.parse(lastCall(created.fetchImpl)[1].body as string).tags).toEqual(["sales"]);
    const updated = setup(json(200, { ok: true }));
    await updated.client.updateIntent("a", { initialStep: "/a", tags: [] });
    expect(JSON.parse(lastCall(updated.fetchImpl)[1].body as string)).toEqual({ initialStep: "/a", tags: [] });
  });

  it("updates by encoded name without sending the name in the body", async () => {
    const { client, fetchImpl } = setup(json(200, { ok: true }));
    await client.updateIntent("order status", { initialStep: "/o", keywords: ["k"] });
    const [url, init] = lastCall(fetchImpl);
    expect(url).toBe("http://gw.test/api/admin/intents/order%20status");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ initialStep: "/o", keywords: ["k"] });
  });

  it("deletes by encoded name", async () => {
    const { client, fetchImpl } = setup(json(200, { ok: true }));
    await client.deleteIntent("a/b");
    const [url, init] = lastCall(fetchImpl);
    expect(url).toBe("http://gw.test/api/admin/intents/a%2Fb");
    expect(init.method).toBe("DELETE");
  });
});

describe("gateway client error mapping", () => {
  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [409, "conflict"],
    [400, "validation"],
    [422, "validation"],
    [500, "unavailable"],
    [502, "unavailable"],
  ] as const)("maps HTTP %i to %s", async (status, kind) => {
    const { client } = setup(json(status, { ok: false, error: "boom" }));
    const error = await client.listIntents().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GatewayError);
    expect((error as GatewayError).kind).toBe(kind);
    expect((error as GatewayError).status).toBe(status);
  });

  it("carries the gateway error message", async () => {
    const { client } = setup(json(409, { ok: false, error: 'Intent "a" already exists' }));
    const error = (await client.deleteIntent("a").catch((e: unknown) => e)) as GatewayError;
    expect(error.message).toBe('Intent "a" already exists');
  });

  it("maps validation messages to field errors", async () => {
    const message = "keywords must contain at least one non-empty keyword";
    const { client } = setup(json(400, { ok: false, error: message }));
    const error = (await client
      .createIntent({ intent: "a", initialStep: "/a", keywords: ["k"] })
      .catch((e: unknown) => e)) as GatewayError;
    expect(error.fieldErrors).toEqual({ keywords: message });
  });

  it("maps a 409 to an intent field error", async () => {
    const message = 'Intent "a" already exists';
    const { client } = setup(json(409, { ok: false, error: message }));
    const error = (await client
      .createIntent({ intent: "a", initialStep: "/a", keywords: ["k"] })
      .catch((e: unknown) => e)) as GatewayError;
    expect(error.fieldErrors).toEqual({ intent: message });
  });

  it("maps network failures to unavailable", async () => {
    const { client } = setup(new Error("ECONNREFUSED"));
    const error = (await client.listIntents().catch((e: unknown) => e)) as GatewayError;
    expect(error.kind).toBe("unavailable");
  });

  it("maps an unexpected 200 body to unexpected_response", async () => {
    const { client } = setup(json(200, { ok: true, intents: "nope" }));
    const error = (await client.listIntents().catch((e: unknown) => e)) as GatewayError;
    expect(error.kind).toBe("unexpected_response");
  });

  it("tolerates non-JSON error bodies", async () => {
    const { client } = setup(new Response("<html>bad gateway</html>", { status: 502 }));
    const error = (await client.listIntents().catch((e: unknown) => e)) as GatewayError;
    expect(error.kind).toBe("unavailable");
    expect(error.message).toMatch(/502/);
  });
});

describe("inferFieldErrors", () => {
  it.each([
    ['Field "initialStep" is required.', { initialStep: 'Field "initialStep" is required.' }],
    ['Field "intent" is required.', { intent: 'Field "intent" is required.' }],
    ["name must be 1-120 characters: letters", { intent: "name must be 1-120 characters: letters" }],
    ['Field "tags" must be an array of at most 10 strings', { tags: 'Field "tags" must be an array of at most 10 strings' }],
    ["each tag must be 1-40 characters", { tags: "each tag must be 1-40 characters" }],
    ["something else", {}],
  ])("%s", (message, expected) => {
    expect(inferFieldErrors(message)).toEqual(expected);
  });
});
