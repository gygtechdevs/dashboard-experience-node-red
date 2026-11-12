import { GatewayError } from "@/lib/gateway/client";

/** User-facing message for failures of the users API. */
export function describeUserError(error: unknown): string {
  if (error instanceof GatewayError) {
    switch (error.kind) {
      case "forbidden":
        // The auth service answers 403 for its own business rules as well as for missing permissions.
        if (/last active admin/i.test(error.message)) return "No se puede dejar al sistema sin administradores activos.";
        if (/deactivate your own/i.test(error.message)) return "No puede desactivar su propia cuenta.";
        return "No tiene permiso para realizar esta acción.";
      case "conflict":
        return "Ya existe un usuario con ese email.";
      case "not_found":
        return "Este usuario ya no existe. Actualice la página e intente nuevamente.";
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
