"use server";

import { revalidatePath } from "next/cache";
import { canManageUsers } from "@/lib/auth/jwt";
import { getSession } from "@/lib/auth/session";
import { GatewayError } from "@/lib/gateway/client";
import { permissionsForLevel } from "@/lib/users/access";
import {
  createUserFormSchema,
  resetPasswordFormSchema,
  updateUserFormSchema,
  userFieldErrors,
  type UserFieldErrors,
} from "@/lib/users/form";
import { describeUserError } from "@/lib/users/messages";
import { withUsers } from "@/lib/users/server";

type Failure = { ok: false; message: string; fieldErrors?: UserFieldErrors };
export type UserActionResult = { ok: true } | Failure;

const PAGE_PATH = "/users";
const FORBIDDEN: Failure = { ok: false, message: "No tiene permiso para realizar esta acción." };
const INVALID_FIELDS = "Corrija los campos resaltados.";

/**
 * UI-level guard only: the JWT payload is decoded, not verified. The gateway
 * re-checks ADMIN on every call and its 403 is surfaced below.
 */
async function adminSession() {
  const session = await getSession();
  return canManageUsers(session) ? session : null;
}

function failure(error: unknown): Failure {
  const message = describeUserError(error);
  // A duplicate email is a field problem, not a form-level one.
  if (error instanceof GatewayError && error.kind === "conflict") {
    return { ok: false, message, fieldErrors: { email: message } };
  }
  return { ok: false, message };
}

export async function createUserAction(input: unknown): Promise<UserActionResult> {
  if (!(await adminSession())) return FORBIDDEN;

  const parsed = createUserFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: INVALID_FIELDS, fieldErrors: userFieldErrors(parsed.error) };

  const { email, password, displayName, level } = parsed.data;
  try {
    await withUsers((client) =>
      client.createUser({
        email,
        password,
        permissions: permissionsForLevel(level),
        ...(displayName ? { displayName } : {}),
      }),
    );
  } catch (error) {
    return failure(error);
  }
  revalidatePath(PAGE_PATH);
  return { ok: true };
}

export async function updateUserAction(id: string, input: unknown): Promise<UserActionResult> {
  const session = await adminSession();
  if (!session) return FORBIDDEN;

  const parsed = updateUserFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: INVALID_FIELDS, fieldErrors: userFieldErrors(parsed.error) };

  const { displayName, level, active } = parsed.data;
  // Guard rails against locking yourself out; the backend also protects the last active admin.
  if (id === session.userId) {
    if (!active) return { ok: false, message: "No puede desactivar su propia cuenta." };
    if (level !== "admin") return { ok: false, message: "No puede quitarse a sí mismo el acceso de administrador." };
  }

  try {
    await withUsers((client) =>
      client.updateUser(id, { displayName: displayName ?? null, permissions: permissionsForLevel(level), active }),
    );
  } catch (error) {
    return failure(error);
  }
  revalidatePath(PAGE_PATH);
  return { ok: true };
}

export async function resetPasswordAction(id: string, input: unknown): Promise<UserActionResult> {
  if (!(await adminSession())) return FORBIDDEN;

  const parsed = resetPasswordFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: INVALID_FIELDS, fieldErrors: userFieldErrors(parsed.error) };

  try {
    await withUsers((client) => client.resetPassword(id, parsed.data.password));
  } catch (error) {
    return failure(error);
  }
  revalidatePath(PAGE_PATH);
  return { ok: true };
}

export async function deactivateUserAction(id: string): Promise<UserActionResult> {
  const session = await adminSession();
  if (!session) return FORBIDDEN;
  if (id === session.userId) return { ok: false, message: "No puede desactivar su propia cuenta." };

  try {
    await withUsers((client) => client.deactivateUser(id));
  } catch (error) {
    return failure(error);
  }
  revalidatePath(PAGE_PATH);
  return { ok: true };
}
