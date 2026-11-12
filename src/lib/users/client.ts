import { GatewayError, kindForStatus } from "@/lib/gateway/client";
import {
  userErrorSchema,
  usersResponseSchema,
  type CreateUserPayload,
  type ManagedUser,
  type UpdateUserPayload,
} from "./schemas";

export interface UsersClientOptions {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface UsersClient {
  listUsers(): Promise<ManagedUser[]>;
  createUser(payload: CreateUserPayload): Promise<void>;
  updateUser(id: string, patch: UpdateUserPayload): Promise<void>;
  resetPassword(id: string, password: string): Promise<void>;
  /** The backend deactivates the account; it never deletes it. */
  deactivateUser(id: string): Promise<void>;
}

async function toError(response: Response): Promise<GatewayError> {
  let message = `El gateway respondió con el estado ${response.status}`;
  try {
    const parsed = userErrorSchema.safeParse(await response.json());
    if (parsed.success) message = parsed.data.message ?? parsed.data.error ?? message;
  } catch {
    // Non-JSON body: keep the generic message.
  }
  return new GatewayError(kindForStatus(response.status), response.status, message);
}

export function createUsersClient({
  baseUrl,
  token,
  fetchImpl = fetch,
  timeoutMs = 10_000,
}: UsersClientOptions): UsersClient {
  const root = baseUrl.replace(/\/+$/, "");

  /** Returns the raw response text; callers that need the body parse it themselves. */
  async function request(path: string, init: { method?: string; body?: unknown } = {}): Promise<string> {
    const headers: Record<string, string> = { authorization: `Bearer ${token}`, accept: "application/json" };
    if (init.body !== undefined) headers["content-type"] = "application/json";

    let response: Response;
    try {
      response = await fetchImpl(`${root}${path}`, {
        method: init.method ?? "GET",
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new GatewayError("unavailable", 0, "No se pudo contactar con el gateway");
    }

    if (!response.ok) throw await toError(response);
    return response.text();
  }

  const userPath = (id: string) => `/api/admin/users/${encodeURIComponent(id)}`;

  return {
    listUsers: async () => {
      const text = await request("/api/admin/users");
      try {
        return usersResponseSchema.parse(JSON.parse(text));
      } catch {
        throw new GatewayError("unexpected_response", 200, "El gateway devolvió una respuesta inesperada");
      }
    },
    createUser: async (payload) => {
      await request("/api/admin/users", { method: "POST", body: payload });
    },
    updateUser: async (id, patch) => {
      await request(userPath(id), { method: "PATCH", body: patch });
    },
    resetPassword: async (id, password) => {
      await request(`${userPath(id)}/password`, { method: "POST", body: { password } });
    },
    deactivateUser: async (id) => {
      await request(userPath(id), { method: "DELETE" });
    },
  };
}
