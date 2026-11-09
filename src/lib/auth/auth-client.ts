import { z } from "zod";

export type LoginFailureReason =
  | "invalid_credentials"
  | "locked"
  | "disabled"
  | "bad_request"
  | "rate_limited"
  | "unavailable";

export type LoginResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: LoginFailureReason };

export interface LoginOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const loginResponseSchema = z.object({ accessToken: z.string().min(1) });

const FAILURE_BY_STATUS: Record<number, LoginFailureReason> = {
  400: "bad_request",
  401: "invalid_credentials",
  403: "disabled",
  423: "locked",
  429: "rate_limited",
};

/**
 * Calls `POST {AUTH_SERVICE_URL}/auth/login`. The service also sets its own
 * cookies on the response; they are ignored here: only `accessToken` is used.
 */
export async function login(
  credentials: { email: string; password: string },
  { baseUrl, fetchImpl = fetch, timeoutMs = 10_000 }: LoginOptions,
): Promise<LoginResult> {
  const url = `${baseUrl.replace(/\/+$/, "")}/auth/login`;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(credentials),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (!response.ok) {
    return { ok: false, reason: FAILURE_BY_STATUS[response.status] ?? "unavailable" };
  }

  try {
    const { accessToken } = loginResponseSchema.parse(await response.json());
    return { ok: true, accessToken };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
