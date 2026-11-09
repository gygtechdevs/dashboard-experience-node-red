/**
 * Client-side-safe JWT helpers. The dashboard never verifies the signature
 * (it does not know the secret): the payload is only read to drive the UI.
 * The gateway remains the authority for every request.
 */

export type Permission = "READ" | "WRITE" | "ADMIN";

const KNOWN_PERMISSIONS: readonly Permission[] = ["READ", "WRITE", "ADMIN"];

export interface Session {
  userId: string;
  email: string;
  permissions: Permission[];
  /** Expiry as epoch milliseconds. */
  expiresAt: number;
}

type Claims = Record<string, unknown>;

function decodeBase64Url(segment: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(segment)) return null;
  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function decodeJwtPayload(token: string): Claims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const json = decodeBase64Url(parts[1]);
  if (json === null) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Claims;
  } catch {
    return null;
  }
}

function readPermissions(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is Permission => KNOWN_PERMISSIONS.includes(p as Permission));
}

/** Returns the session described by the token, or null if malformed or expired. */
export function parseSession(token: string, nowMs: number = Date.now()): Session | null {
  const claims = decodeJwtPayload(token);
  if (!claims || typeof claims.exp !== "number") return null;
  const expiresAt = claims.exp * 1000;
  if (expiresAt <= nowMs) return null;
  return {
    userId: typeof claims.sub === "string" ? claims.sub : "",
    email: typeof claims.email === "string" ? claims.email : "",
    permissions: readPermissions(claims.permissions),
    expiresAt,
  };
}

export function secondsUntilExpiry(token: string, nowMs: number = Date.now()): number {
  const claims = decodeJwtPayload(token);
  if (!claims || typeof claims.exp !== "number") return 0;
  return Math.max(0, Math.floor(claims.exp - nowMs / 1000));
}

/** POST/PUT on /api/admin/* require WRITE or ADMIN. */
export function canWriteIntents(session: Session | null): boolean {
  return !!session && (session.permissions.includes("WRITE") || session.permissions.includes("ADMIN"));
}

/** DELETE on /api/admin/intents/:intent requires ADMIN. */
export function canDeleteIntents(session: Session | null): boolean {
  return !!session && session.permissions.includes("ADMIN");
}

/** The review queue (/api/admin/unmatched) is ADMIN-only in intents-service. */
export function canReviewUnmatched(session: Session | null): boolean {
  return !!session && session.permissions.includes("ADMIN");
}
