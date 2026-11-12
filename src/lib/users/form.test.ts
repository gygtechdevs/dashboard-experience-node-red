import { describe, expect, it } from "vitest";
import {
  createUserFormSchema,
  resetPasswordFormSchema,
  updateUserFormSchema,
  userFieldErrors,
} from "./form";

describe("createUserFormSchema", () => {
  it("accepts a valid user and trims text", () => {
    const parsed = createUserFormSchema.parse({
      email: "  Ana@Example.com ",
      password: "long-enough-1",
      displayName: " Ana ",
      level: "write",
    });
    expect(parsed).toEqual({ email: "ana@example.com", password: "long-enough-1", displayName: "Ana", level: "write" });
  });

  it("treats a blank display name as absent", () => {
    const parsed = createUserFormSchema.parse({ email: "a@b.co", password: "long-enough-1", displayName: "  ", level: "read" });
    expect(parsed.displayName).toBeUndefined();
  });

  it("reports one Spanish message per invalid field", () => {
    const result = createUserFormSchema.safeParse({ email: "nope", password: "short", level: "root" });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = userFieldErrors(result.error);
    expect(errors.email).toBe("Ingrese un email válido.");
    expect(errors.password).toBe("La contraseña debe tener al menos 8 caracteres.");
    expect(errors.level).toBe("Seleccione un nivel de acceso.");
  });
});

describe("updateUserFormSchema", () => {
  it("accepts level, active and optional display name", () => {
    expect(updateUserFormSchema.parse({ displayName: "Ana", level: "admin", active: false })).toEqual({
      displayName: "Ana",
      level: "admin",
      active: false,
    });
  });

  it("rejects a missing active flag", () => {
    expect(updateUserFormSchema.safeParse({ level: "read" }).success).toBe(false);
  });
});

describe("resetPasswordFormSchema", () => {
  it("requires at least 8 characters", () => {
    expect(resetPasswordFormSchema.safeParse({ password: "1234567" }).success).toBe(false);
    expect(resetPasswordFormSchema.safeParse({ password: "12345678" }).success).toBe(true);
  });
});
