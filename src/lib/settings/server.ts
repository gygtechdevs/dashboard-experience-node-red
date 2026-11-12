import "server-only";
import { settingsApiKey, settingsUrl } from "@/lib/config";
import type { Step } from "@/lib/gateway/schemas";
import { createSettingsClient } from "./client";

/** Steps catalog from node-red-settings. Throws GatewayError("unavailable" | "unexpected_response"). */
export function listSteps(): Promise<Step[]> {
  return createSettingsClient({ baseUrl: settingsUrl(), apiKey: settingsApiKey() }).listSteps();
}
