import { GatewayError } from "@/lib/gateway/client";

export type ReviewOperation = "list" | "approve" | "reject" | "clusters" | "simulate" | "bulk-approve" | "bulk-reject";

export const CAPTURE_DISABLED_TITLE = "La captura de mensajes no reconocidos está deshabilitada";
export const CAPTURE_DISABLED_HELP =
  "Configure UNMATCHED_CAPTURE_ENABLED=true en el servicio de intenciones y reinícielo para comenzar a recopilar los mensajes que el bot no entendió.";

/** The review routes are only mounted when capture is on, so a 404 on the list means it is off. */
export function isCaptureDisabled(error: unknown): boolean {
  return error instanceof GatewayError && error.kind === "not_found";
}

export const ADMIN_REQUIRED_MESSAGE = "Se requiere permiso ADMIN para revisar los mensajes no reconocidos.";

/** User-facing message for review-queue failures. */
export function describeReviewError(error: unknown, operation: ReviewOperation): string {
  if (error instanceof GatewayError) {
    switch (error.kind) {
      case "forbidden":
        return ADMIN_REQUIRED_MESSAGE;
      case "not_found":
        if (operation === "list" || operation === "clusters") return `${CAPTURE_DISABLED_TITLE}. ${CAPTURE_DISABLED_HELP}`;
        if (operation === "simulate" || operation === "bulk-approve") {
          return "La intención o los mensajes seleccionados ya no existen. Los grupos se actualizaron.";
        }
        return "Este mensaje ya no existe. La lista se actualizó.";
      case "conflict":
        return "Este mensaje ya fue revisado por otra persona. La lista se actualizó.";
      case "unavailable":
        if (error.status === 503 && (operation === "approve" || operation === "bulk-approve")) {
          return "La coincidencia semántica está deshabilitada (SEMANTIC_ENABLED=false), por lo que no se pueden aprobar ejemplos en este momento. Aún es posible rechazar mensajes.";
        }
        if (error.status === 503 && operation === "simulate") {
          return "La simulación de impacto requiere coincidencia semántica (SEMANTIC_ENABLED=true) y un servicio de vectorización operativo.";
        }
        return "El servicio no está disponible en este momento. Intente nuevamente en unos instantes.";
      case "unexpected_response":
        return "El servicio devolvió una respuesta inesperada.";
      default:
        return error.message;
    }
  }
  return "Algo salió mal. Intente nuevamente.";
}
