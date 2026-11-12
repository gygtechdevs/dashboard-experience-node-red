import { z } from "zod";
import { GatewayError } from "@/lib/gateway/client";
import type { Step } from "@/lib/gateway/schemas";

/** Registry shape served by node-red-settings: GET /api/steps. */
const registrySchema = z.object({
  steps: z.array(
    z.object({
      id: z.string(),
      name: z.string().nullable(),
      intent: z.string(),
      path: z.string(),
    }),
  ),
});

export interface SettingsClientOptions {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface SettingsClient {
  listSteps(): Promise<Step[]>;
}

/**
 * Errors reuse GatewayError so callers keep one failure type. Every non-2xx is
 * "unavailable": a settings 401 means a bad service API key, not an expired
 * user session, so it must never trigger the /login redirect.
 */
export function createSettingsClient({
  baseUrl,
  apiKey,
  fetchImpl = fetch,
  timeoutMs = 10_000,
}: SettingsClientOptions): SettingsClient {
  const root = baseUrl.replace(/\/+$/, "");

  return {
    listSteps: async () => {
      let response: Response;
      try {
        response = await fetchImpl(`${root}/api/steps`, {
          method: "GET",
          headers: { "x-api-key": apiKey, accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new GatewayError("unavailable", 0, "No se pudo contactar con el servicio de configuración");
      }

      if (!response.ok) {
        throw new GatewayError(
          "unavailable",
          response.status,
          `El servicio de configuración respondió con el estado ${response.status}`,
        );
      }

      try {
        const { steps } = registrySchema.parse(await response.json());
        return steps.map((step) => ({ name: step.name ?? step.intent, path: step.path }));
      } catch {
        throw new GatewayError(
          "unexpected_response",
          response.status,
          "El servicio de configuración devolvió una respuesta inesperada",
        );
      }
    },
  };
}
