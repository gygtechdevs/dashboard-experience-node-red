import { describe, expect, it } from "vitest";
import { GatewayError } from "@/lib/gateway/client";
import { describeUserError } from "./messages";

const err = (kind: ConstructorParameters<typeof GatewayError>[0], message = "raw") => new GatewayError(kind, 0, message);

describe("describeUserError", () => {
  it("explains a duplicate email", () => {
    expect(describeUserError(err("conflict"))).toBe("Ya existe un usuario con ese email.");
  });

  it("explains forbidden, missing and unavailable", () => {
    expect(describeUserError(err("forbidden"))).toBe("No tiene permiso para realizar esta acción.");
    expect(describeUserError(err("not_found"))).toBe("Este usuario ya no existe. Actualice la página e intente nuevamente.");
    expect(describeUserError(err("unavailable"))).toBe(
      "El servicio no está disponible en este momento. Intente nuevamente en unos instantes.",
    );
  });

  it("keeps the backend message for validation errors", () => {
    expect(describeUserError(err("validation", "Cannot remove the last active admin"))).toBe(
      "Cannot remove the last active admin",
    );
  });

  it("falls back to a generic message for unknown errors", () => {
    expect(describeUserError(new Error("x"))).toBe("Algo salió mal. Intente nuevamente.");
  });
});

describe("describeUserError business rules (backend answers 403 for them)", () => {
  it("translates the last-admin and self-deactivation rules", () => {
    expect(describeUserError(err("forbidden", "Cannot remove the last active admin"))).toBe(
      "No se puede dejar al sistema sin administradores activos.",
    );
    expect(describeUserError(err("forbidden", "You cannot deactivate your own account"))).toBe(
      "No puede desactivar su propia cuenta.",
    );
  });
});
