import "server-only";
import { gatewayUrl } from "@/lib/config";
import { withSessionToken } from "@/lib/gateway/server";
import { createUsersClient, type UsersClient } from "./client";

/** Server-side entry point for the users admin API; same session/401 handling as withGateway. */
export function withUsers<T>(operation: (client: UsersClient) => Promise<T>): Promise<T> {
  return withSessionToken((token) => createUsersClient({ baseUrl: gatewayUrl(), token }), operation);
}
