import "server-only";

/** Server-side configuration. Nothing here is exposed to the browser. */
export function authServiceUrl(): string {
  return process.env.AUTH_SERVICE_URL ?? "http://localhost:4001";
}

export function gatewayUrl(): string {
  return process.env.GATEWAY_URL ?? "http://localhost:8080";
}

export function settingsUrl(): string {
  return process.env.SETTINGS_URL ?? "http://localhost:3002";
}

export function settingsApiKey(): string {
  return process.env.SETTINGS_API_KEY ?? "";
}

/** Secure cookies in production; set COOKIE_SECURE=false to run `next start` over plain HTTP. */
export function cookieSecure(): boolean {
  const override = process.env.COOKIE_SECURE;
  if (override === "true") return true;
  if (override === "false") return false;
  return process.env.NODE_ENV === "production";
}
