import { describe, expect, it } from "vitest";
import {
  canDeleteIntents,
  canReviewUnmatched,
  canWriteIntents,
  decodeJwtPayload,
  parseSession,
  secondsUntilExpiry,
} from "./jwt";

function b64url(value: object | string): string {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  return Buffer.from(raw).toString("base64url");
}

function makeToken(payload: object): string {
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.signature`;
}

const NOW_MS = 1_700_000_000_000;
const NOW_S = NOW_MS / 1000;

describe("decodeJwtPayload", () => {
  it("decodes the payload without verifying the signature", () => {
    const token = makeToken({ sub: "u1", email: "a@b.co" });
    expect(decodeJwtPayload(token)).toEqual({ sub: "u1", email: "a@b.co" });
  });

  it("handles non-ASCII characters in the payload", () => {
    const token = makeToken({ email: "ñandú@example.com" });
    expect(decodeJwtPayload(token)?.email).toBe("ñandú@example.com");
  });

  it.each(["", "abc", "a.b", "a.%%%.c", `a.${b64url("not json")}.c`, `a.${b64url("[1]")}.c`])(
    "returns null for malformed token %j",
    (token) => {
      expect(decodeJwtPayload(token)).toBeNull();
    },
  );
});

describe("parseSession", () => {
  const valid = {
    sub: "user-1",
    email: "po@example.com",
    permissions: ["READ", "WRITE"],
    exp: NOW_S + 900,
  };

  it("reads identity, permissions and expiry from the claims", () => {
    expect(parseSession(makeToken(valid), NOW_MS)).toEqual({
      userId: "user-1",
      email: "po@example.com",
      permissions: ["READ", "WRITE"],
      expiresAt: (NOW_S + 900) * 1000,
    });
  });

  it("returns null when the token is expired", () => {
    expect(parseSession(makeToken({ ...valid, exp: NOW_S - 1 }), NOW_MS)).toBeNull();
  });

  it("returns null when exp is missing", () => {
    expect(parseSession(makeToken({ ...valid, exp: undefined }), NOW_MS)).toBeNull();
  });

  it("returns null for garbage", () => {
    expect(parseSession("garbage", NOW_MS)).toBeNull();
  });

  it("drops unknown permission values and tolerates a missing array", () => {
    const withUnknown = makeToken({ ...valid, permissions: ["READ", "ROOT", 3] });
    expect(parseSession(withUnknown, NOW_MS)?.permissions).toEqual(["READ"]);
    const without = makeToken({ ...valid, permissions: undefined });
    expect(parseSession(without, NOW_MS)?.permissions).toEqual([]);
  });
});

describe("permission helpers", () => {
  const session = (permissions: ("READ" | "WRITE" | "ADMIN")[]) => ({
    userId: "u",
    email: "e@x.co",
    permissions,
    expiresAt: NOW_MS + 1000,
  });

  it("allows writes for WRITE or ADMIN only", () => {
    expect(canWriteIntents(session(["READ"]))).toBe(false);
    expect(canWriteIntents(session(["READ", "WRITE"]))).toBe(true);
    expect(canWriteIntents(session(["ADMIN"]))).toBe(true);
    expect(canWriteIntents(null)).toBe(false);
  });

  it("allows deletes for ADMIN only (gateway requires it)", () => {
    expect(canDeleteIntents(session(["READ", "WRITE"]))).toBe(false);
    expect(canDeleteIntents(session(["ADMIN"]))).toBe(true);
    expect(canDeleteIntents(null)).toBe(false);
  });
});

describe("secondsUntilExpiry", () => {
  it("returns whole seconds remaining, floored", () => {
    expect(secondsUntilExpiry(makeToken({ exp: NOW_S + 900.9 }), NOW_MS)).toBe(900);
  });

  it("returns 0 for expired or invalid tokens", () => {
    expect(secondsUntilExpiry(makeToken({ exp: NOW_S - 5 }), NOW_MS)).toBe(0);
    expect(secondsUntilExpiry("bad", NOW_MS)).toBe(0);
  });
});

describe("canReviewUnmatched", () => {
  const session = (permissions: Array<"READ" | "WRITE" | "ADMIN">) => ({ userId: "u", email: "e", permissions, expiresAt: 1 });

  it("requires ADMIN", () => {
    expect(canReviewUnmatched(session(["ADMIN"]))).toBe(true);
    expect(canReviewUnmatched(session(["WRITE"]))).toBe(false);
    expect(canReviewUnmatched(null)).toBe(false);
  });
});
