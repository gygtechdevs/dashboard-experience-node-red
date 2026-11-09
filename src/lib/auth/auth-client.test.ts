import { describe, expect, it, vi } from "vitest";
import { login } from "./auth-client";

const BASE = "http://auth.test";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("login", () => {
  it("posts credentials as JSON and returns the access token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        accessToken: "tok",
        user: { id: "1", email: "a@b.co", displayName: "A", permissions: ["READ"] },
      }),
    );

    const result = await login({ email: "a@b.co", password: "pw" }, { baseUrl: BASE, fetchImpl });

    expect(result).toEqual({ ok: true, accessToken: "tok" });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("http://auth.test/auth/login");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "a@b.co", password: "pw" });
    expect(init.cache).toBe("no-store");
  });

  it("strips a trailing slash from the base url", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { accessToken: "t" }));
    await login({ email: "a@b.co", password: "x" }, { baseUrl: `${BASE}/`, fetchImpl });
    expect(fetchImpl.mock.calls[0][0]).toBe("http://auth.test/auth/login");
  });

  it.each([
    [401, "invalid_credentials"],
    [423, "locked"],
    [403, "disabled"],
    [400, "bad_request"],
    [429, "rate_limited"],
    [500, "unavailable"],
  ] as const)("maps HTTP %i to %s", async (status, reason) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(status, { message: "nope" }));
    const result = await login({ email: "a@b.co", password: "x" }, { baseUrl: BASE, fetchImpl });
    expect(result).toEqual({ ok: false, reason });
  });

  it("reports unavailable when the network call throws", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await login({ email: "a@b.co", password: "x" }, { baseUrl: BASE, fetchImpl });
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });

  it("reports unavailable when a 200 response has no accessToken", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { hello: "world" }));
    const result = await login({ email: "a@b.co", password: "x" }, { baseUrl: BASE, fetchImpl });
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });
});
