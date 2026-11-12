import { z } from "zod";

/**
 * node-red-auth returns `displayName` (camelCase) and the gateway relays the
 * body untouched; snake_case aliases and missing optional fields are tolerated
 * because the exact shapes are owned by another service.
 */
const rawUserSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    displayName: z.string().nullish(),
    display_name: z.string().nullish(),
    permissions: z.array(z.string()).default([]),
    active: z.boolean().default(true),
    mustChangePassword: z.boolean().optional(),
    must_change_password: z.boolean().optional(),
    lastLoginAt: z.string().nullish(),
    last_login_at: z.string().nullish(),
  })
  .loose();

export const userSchema = rawUserSchema.transform((raw) => ({
  id: raw.id,
  email: raw.email,
  displayName: raw.displayName ?? raw.display_name ?? null,
  permissions: raw.permissions,
  active: raw.active,
  mustChangePassword: raw.mustChangePassword ?? raw.must_change_password ?? false,
  lastLoginAt: raw.lastLoginAt ?? raw.last_login_at ?? null,
}));

export type ManagedUser = z.output<typeof userSchema>;

/** The auth service answers a bare array; a `{ users }` envelope is accepted as well. */
export const usersResponseSchema = z.union([
  z.array(userSchema),
  z
    .object({ users: z.array(userSchema) })
    .loose()
    .transform((body) => body.users),
]);

/** `{ message }` from node-red-auth, `{ ok: false, error }` from the gateway itself. */
export const userErrorSchema = z.object({ message: z.string().optional(), error: z.string().optional() }).loose();

export interface CreateUserPayload {
  email: string;
  password: string;
  displayName?: string | null;
  permissions: string[];
}

export interface UpdateUserPayload {
  permissions?: string[];
  active?: boolean;
  displayName?: string | null;
  mustChangePassword?: boolean;
}
