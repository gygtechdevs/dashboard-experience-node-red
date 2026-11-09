"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { login, type LoginFailureReason } from "@/lib/auth/auth-client";
import { HOME_PATH, LOGIN_PATH } from "@/lib/auth/constants";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";
import { authServiceUrl } from "@/lib/config";

export interface LoginState {
  error?: string;
}

const credentialsSchema = z.object({
  email: z.email("Ingrese una dirección de correo electrónico válida"),
  password: z.string().min(1, "Ingrese su contraseña"),
});

const MESSAGES: Record<LoginFailureReason, string> = {
  invalid_credentials: "Correo electrónico o contraseña incorrectos.",
  locked: "Esta cuenta está bloqueada temporalmente. Intente nuevamente más tarde.",
  disabled: "Esta cuenta está deshabilitada. Contacte a un administrador.",
  bad_request: "Ingrese su correo electrónico y su contraseña.",
  rate_limited: "Demasiados intentos. Espere un momento e intente nuevamente.",
  unavailable: "El servicio de inicio de sesión no está disponible. Intente nuevamente en unos instantes.",
};

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await login(parsed.data, { baseUrl: authServiceUrl() });
  if (!result.ok) return { error: MESSAGES[result.reason] };

  const stored = await setSessionCookie(result.accessToken);
  if (!stored) return { error: MESSAGES.unavailable };

  redirect(HOME_PATH);
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect(LOGIN_PATH);
}
