import { z } from "zod";
import { ACCESS_LEVELS } from "./access";

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_DISPLAY_NAME_LENGTH = 100;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Ingrese un email válido."));

const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
  .max(MAX_PASSWORD_LENGTH, `La contraseña no puede superar los ${MAX_PASSWORD_LENGTH} caracteres.`);

const displayName = z
  .string()
  .trim()
  .max(MAX_DISPLAY_NAME_LENGTH, `El nombre no puede superar los ${MAX_DISPLAY_NAME_LENGTH} caracteres.`)
  .optional()
  .transform((value) => (value ? value : undefined));

const level = z.enum(ACCESS_LEVELS, { error: "Seleccione un nivel de acceso." });

export const createUserFormSchema = z.object({ email, password, displayName, level });
export const updateUserFormSchema = z.object({ displayName, level, active: z.boolean() });
export const resetPasswordFormSchema = z.object({ password });

export type CreateUserForm = z.output<typeof createUserFormSchema>;
export type UpdateUserForm = z.output<typeof updateUserFormSchema>;

export type UserFieldErrors = Partial<Record<"email" | "password" | "displayName" | "level" | "active", string>>;

/** First message per field, ready to render under each input. */
export function userFieldErrors(error: z.ZodError): UserFieldErrors {
  const result: UserFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in result)) {
      result[field as keyof UserFieldErrors] = issue.message;
    }
  }
  return result;
}
