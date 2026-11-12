import "server-only";
import { redirect } from "next/navigation";
import { SESSION_EXPIRED_PATH } from "@/lib/auth/constants";
import { getAccessToken } from "@/lib/auth/session";
import { gatewayUrl } from "@/lib/config";
import { GatewayError, createGatewayClient, type GatewayClient } from "./client";

/**
 * Single entry point for server-side gateway calls (Server Components and
 * Server Actions). A missing token or a gateway 401 clears the session and
 * sends the user to /login via the /session-expired route handler (cookies
 * cannot be modified while rendering, so the handler does it).
 */
export async function withGateway<T>(operation: (client: GatewayClient) => Promise<T>): Promise<T> {
  return withSessionToken((token) => createGatewayClient({ baseUrl: gatewayUrl(), token }), operation);
}

/** Shared session handling for every client that talks to the gateway on behalf of the signed-in user. */
export async function withSessionToken<C, T>(
  createClient: (token: string) => C,
  operation: (client: C) => Promise<T>,
): Promise<T> {
  const token = await getAccessToken();
  if (!token) redirect(SESSION_EXPIRED_PATH);

  try {
    return await operation(createClient(token));
  } catch (error) {
    if (error instanceof GatewayError && error.kind === "unauthorized") {
      redirect(SESSION_EXPIRED_PATH);
    }
    throw error;
  }
}

/** User-facing message for errors that are not tied to a form field. */
export function describeGatewayError(error: unknown): string {
  if (error instanceof GatewayError) {
    switch (error.kind) {
      case "forbidden":
        return "No tiene permiso para realizar esta acción.";
      case "not_found":
        return "Esta intención ya no existe. Actualice la página e intente nuevamente.";
      case "unavailable":
        return "El servicio no está disponible en este momento. Intente nuevamente en unos instantes.";
      case "unexpected_response":
        return "El servicio devolvió una respuesta inesperada.";
      default:
        return error.message;
    }
  }
  return "Algo salió mal. Intente nuevamente.";
}
