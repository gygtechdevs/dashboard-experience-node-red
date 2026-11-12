import { beforeEach, describe, expect, it, vi } from "vitest";
import { GatewayError } from "@/lib/gateway/client";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  revalidatePath: vi.fn(),
  client: {
    listUsers: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    resetPassword: vi.fn(),
    deactivateUser: vi.fn(),
  },
}));

vi.mock("@/lib/auth/session", () => ({ getSession: mocks.getSession }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/users/server", () => ({
  withUsers: (operation: (client: typeof mocks.client) => Promise<unknown>) => operation(mocks.client),
}));

import { createUserAction, deactivateUserAction, resetPasswordAction, updateUserAction } from "./actions";

const ADMIN = { userId: "admin-1", email: "admin@example.com", permissions: ["READ", "WRITE", "ADMIN"], expiresAt: 1 };
const WRITER = { userId: "w-1", email: "w@example.com", permissions: ["READ", "WRITE"], expiresAt: 1 };
const FORBIDDEN = { ok: false, message: "No tiene permiso para realizar esta acción." };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue(ADMIN);
});

describe("authorization", () => {
  it.each([
    ["create", () => createUserAction({})],
    ["update", () => updateUserAction("u1", {})],
    ["reset", () => resetPasswordAction("u1", {})],
    ["deactivate", () => deactivateUserAction("u1")],
  ])("%s is forbidden without ADMIN and never reaches the backend", async (_name, run) => {
    mocks.getSession.mockResolvedValue(WRITER);
    expect(await run()).toEqual(FORBIDDEN);
    for (const fn of Object.values(mocks.client)) expect(fn).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("createUserAction", () => {
  it("maps the level to permissions, calls the backend and revalidates", async () => {
    mocks.client.createUser.mockResolvedValue(undefined);
    const result = await createUserAction({
      email: "New@Example.com",
      password: "long-enough-1",
      displayName: "Nu",
      level: "write",
    });
    expect(result).toEqual({ ok: true });
    expect(mocks.client.createUser).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "long-enough-1",
      displayName: "Nu",
      permissions: ["READ", "WRITE"],
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/users");
  });

  it("returns field errors for invalid input without calling the backend", async () => {
    const result = await createUserAction({ email: "bad", password: "x", level: "read" });
    expect(result).toMatchObject({
      ok: false,
      message: "Corrija los campos resaltados.",
      fieldErrors: { email: expect.any(String), password: expect.any(String) },
    });
    expect(mocks.client.createUser).not.toHaveBeenCalled();
  });

  it("surfaces a duplicate email on the email field", async () => {
    mocks.client.createUser.mockRejectedValue(new GatewayError("conflict", 409, "Email already in use"));
    expect(await createUserAction({ email: "a@b.co", password: "long-enough-1", level: "read" })).toEqual({
      ok: false,
      message: "Ya existe un usuario con ese email.",
      fieldErrors: { email: "Ya existe un usuario con ese email." },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateUserAction", () => {
  it("sends permissions, active and displayName", async () => {
    mocks.client.updateUser.mockResolvedValue(undefined);
    expect(await updateUserAction("u1", { displayName: "Ana", level: "read", active: false })).toEqual({ ok: true });
    expect(mocks.client.updateUser).toHaveBeenCalledWith("u1", {
      displayName: "Ana",
      permissions: ["READ"],
      active: false,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/users");
  });

  it("clears a blank display name with null", async () => {
    mocks.client.updateUser.mockResolvedValue(undefined);
    await updateUserAction("u1", { displayName: "", level: "admin", active: true });
    expect(mocks.client.updateUser).toHaveBeenCalledWith("u1", {
      displayName: null,
      permissions: ["READ", "WRITE", "ADMIN"],
      active: true,
    });
  });

  it("blocks removing your own ADMIN level", async () => {
    const result = await updateUserAction("admin-1", { level: "write", active: true });
    expect(result).toEqual({ ok: false, message: "No puede quitarse a sí mismo el acceso de administrador." });
    expect(mocks.client.updateUser).not.toHaveBeenCalled();
  });

  it("blocks deactivating yourself through the edit form", async () => {
    const result = await updateUserAction("admin-1", { level: "admin", active: false });
    expect(result).toEqual({ ok: false, message: "No puede desactivar su propia cuenta." });
    expect(mocks.client.updateUser).not.toHaveBeenCalled();
  });

  it("lets you edit yourself when keeping ADMIN and staying active", async () => {
    mocks.client.updateUser.mockResolvedValue(undefined);
    expect(await updateUserAction("admin-1", { displayName: "Yo", level: "admin", active: true })).toEqual({ ok: true });
  });

  it("maps a backend failure to a message", async () => {
    mocks.client.updateUser.mockRejectedValue(new GatewayError("not_found", 404, "User not found"));
    expect(await updateUserAction("u9", { level: "read", active: true })).toEqual({
      ok: false,
      message: "Este usuario ya no existe. Actualice la página e intente nuevamente.",
    });
  });
});

describe("resetPasswordAction", () => {
  it("resets the password and revalidates", async () => {
    mocks.client.resetPassword.mockResolvedValue(undefined);
    expect(await resetPasswordAction("u1", { password: "brand-new-pass" })).toEqual({ ok: true });
    expect(mocks.client.resetPassword).toHaveBeenCalledWith("u1", "brand-new-pass");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/users");
  });

  it("rejects short passwords", async () => {
    const result = await resetPasswordAction("u1", { password: "short" });
    expect(result).toMatchObject({ ok: false, fieldErrors: { password: expect.any(String) } });
    expect(mocks.client.resetPassword).not.toHaveBeenCalled();
  });
});

describe("deactivateUserAction", () => {
  it("deactivates another user and revalidates", async () => {
    mocks.client.deactivateUser.mockResolvedValue(undefined);
    expect(await deactivateUserAction("u1")).toEqual({ ok: true });
    expect(mocks.client.deactivateUser).toHaveBeenCalledWith("u1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/users");
  });

  it("blocks deactivating yourself", async () => {
    expect(await deactivateUserAction("admin-1")).toEqual({ ok: false, message: "No puede desactivar su propia cuenta." });
    expect(mocks.client.deactivateUser).not.toHaveBeenCalled();
  });

  it("maps a backend failure to a message", async () => {
    mocks.client.deactivateUser.mockRejectedValue(
      new GatewayError("forbidden", 403, "Cannot remove the last active admin"),
    );
    expect(await deactivateUserAction("u1")).toEqual({
      ok: false,
      message: "No se puede dejar al sistema sin administradores activos.",
    });
  });
});
