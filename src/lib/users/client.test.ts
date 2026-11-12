import { describe, expect, it, vi } from "vitest";
import { GatewayError } from "@/lib/gateway/client";
import { createUsersClient } from "./client";

const BASE = "http://gw.test";

const RAW_USER = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "ana@example.com",
  displayName: "Ana",
  permissions: ["READ", "WRITE"],
  active: true,
  mustChangePassword: false,
  lastLoginAt: "2026-01-02T03:04:05.000Z",
  lockedUntil: null,
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function setup(response: Response | Error) {
  const fetchImpl = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  const client = createUsersClient({ baseUrl: `${BASE}/`, token: "jwt-123", fetchImpl });
  return { client, fetchImpl };
}

function lastCall(fetchImpl: ReturnType<typeof setup>["fetchImpl"]) {
  return fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
}

describe("users client requests", () => {
  it("lists users with the bearer token and normalizes them", async () => {
    const { client, fetchImpl } = setup(json(200, [RAW_USER]));
    const users = await client.listUsers();
    expect(users).toEqual([
      {
        id: RAW_USER.id,
        email: "ana@example.com",
        displayName: "Ana",
        permissions: ["READ", "WRITE"],
        active: true,
        mustChangePassword: false,
        lastLoginAt: "2026-01-02T03:04:05.000Z",
      },
    ]);
    const [url, init] = lastCall(fetchImpl);
    expect(url).toBe("http://gw.test/api/admin/users");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer jwt-123");
    expect(init.cache).toBe("no-store");
  });

  it("accepts an enveloped list and snake_case / missing optional fields", async () => {
    const { client } = setup(
      json(200, {
        ok: true,
        users: [{ id: "u1", email: "b@example.com", display_name: null, permissions: ["ADMIN"], active: false }],
      }),
    );
    expect(await client.listUsers()).toEqual([
      {
        id: "u1",
        email: "b@example.com",
        displayName: null,
        permissions: ["ADMIN"],
        active: false,
        mustChangePassword: false,
        lastLoginAt: null,
      },
    ]);
  });

  it("creates a user with a JSON body", async () => {
    const { client, fetchImpl } = setup(json(201, RAW_USER));
    await client.createUser({ email: "a@b.co", password: "secret123", displayName: "A", permissions: ["READ"] });
    const [url, init] = lastCall(fetchImpl);
    expect(url).toBe("http://gw.test/api/admin/users");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "a@b.co",
      password: "secret123",
      displayName: "A",
      permissions: ["READ"],
    });
  });

  it("patches a user by encoded id", async () => {
    const { client, fetchImpl } = setup(json(200, RAW_USER));
    await client.updateUser("a/b", { active: false, permissions: ["READ"] });
    const [url, init] = lastCall(fetchImpl);
    expect(url).toBe("http://gw.test/api/admin/users/a%2Fb");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ active: false, permissions: ["READ"] });
  });

  it("resets a password through the dedicated endpoint", async () => {
    const { client, fetchImpl } = setup(json(200, RAW_USER));
    await client.resetPassword("u1", "new-secret-1");
    const [url, init] = lastCall(fetchImpl);
    expect(url).toBe("http://gw.test/api/admin/users/u1/password");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ password: "new-secret-1" });
  });

  it("deactivates with DELETE and tolerates any success body", async () => {
    const { client, fetchImpl } = setup(json(200, { message: "User deactivated" }));
    await expect(client.deactivateUser("u1")).resolves.toBeUndefined();
    const [url, init] = lastCall(fetchImpl);
    expect(url).toBe("http://gw.test/api/admin/users/u1");
    expect(init.method).toBe("DELETE");
  });

  it("tolerates an empty success body", async () => {
    const { client } = setup(new Response(null, { status: 204 }));
    await expect(client.deactivateUser("u1")).resolves.toBeUndefined();
  });
});

describe("users client errors", () => {
  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [409, "conflict"],
    [400, "validation"],
    [502, "unavailable"],
  ])("maps %i to %s", async (status, kind) => {
    const { client } = setup(json(status, { message: "boom" }));
    await expect(client.listUsers()).rejects.toMatchObject({ kind, status, message: "boom" });
  });

  it("reads the message from the gateway error envelope too", async () => {
    const { client } = setup(json(400, { ok: false, error: "email, password and permissions are required" }));
    await expect(client.createUser({ email: "", password: "", permissions: [] })).rejects.toMatchObject({
      kind: "validation",
      message: "email, password and permissions are required",
    });
  });

  it("falls back to a generic message for non-JSON bodies", async () => {
    const { client } = setup(new Response("oops", { status: 500 }));
    const error = await client.listUsers().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GatewayError);
    expect((error as GatewayError).kind).toBe("unavailable");
  });

  it("reports network failures as unavailable", async () => {
    const { client } = setup(new Error("ECONNREFUSED"));
    await expect(client.listUsers()).rejects.toMatchObject({ kind: "unavailable", status: 0 });
  });

  it("reports an unparseable list as unexpected_response", async () => {
    const { client } = setup(json(200, { nope: true }));
    await expect(client.listUsers()).rejects.toMatchObject({ kind: "unexpected_response" });
  });
});
