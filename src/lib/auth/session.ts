import "server-only";
import { cookies } from "next/headers";
import { cookieSecure } from "@/lib/config";
import { SESSION_COOKIE } from "./constants";
import { parseSession, secondsUntilExpiry, type Session } from "./jwt";

export async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/** Decoded (unverified) session for UI decisions; null when absent, malformed or expired. */
export async function getSession(): Promise<Session | null> {
  "use cache: private";
  const token = await getAccessToken();
  return token ? parseSession(token) : null;
}

/** Stores the token for exactly as long as the JWT itself is valid. Server Actions / Route Handlers only. */
export async function setSessionCookie(token: string): Promise<boolean> {
  const maxAge = secondsUntilExpiry(token);
  if (maxAge <= 0) return false;
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return true;
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
