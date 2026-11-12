// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedUser } from "@/lib/users/schemas";

const actions = vi.hoisted(() => ({
  createUserAction: vi.fn(),
  updateUserAction: vi.fn(),
  resetPasswordAction: vi.fn(),
  deactivateUserAction: vi.fn(),
}));
vi.mock("@/app/(dashboard)/users/actions", () => actions);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { UsersTable } from "./users-table";

const users: ManagedUser[] = [
  {
    id: "me",
    email: "admin@example.com",
    displayName: "Admin",
    permissions: ["READ", "WRITE", "ADMIN"],
    active: true,
    mustChangePassword: false,
    lastLoginAt: "2026-03-04T05:06:07.000Z",
  },
  {
    id: "u2",
    email: "ana@example.com",
    displayName: null,
    permissions: ["READ"],
    active: false,
    mustChangePassword: false,
    lastLoginAt: null,
  },
  {
    id: "u3",
    email: "bob@example.com",
    displayName: "Bob",
    permissions: ["READ", "WRITE"],
    active: true,
    mustChangePassword: true,
    lastLoginAt: null,
  },
];

function renderTable() {
  return render(<UsersTable users={users} currentUserId="me" />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UsersTable", () => {
  it("shows email, name, access level, status and last access", () => {
    renderTable();
    const admin = screen.getByRole("row", { name: /admin@example.com/ });
    expect(within(admin).getByText("Admin")).toBeInTheDocument();
    expect(within(admin).getByText("Administrador")).toBeInTheDocument();
    expect(within(admin).getByText("Activo")).toBeInTheDocument();
    expect(within(admin).getByText("2026-03-04 05:06 UTC")).toBeInTheDocument();

    const ana = screen.getByRole("row", { name: /ana@example.com/ });
    expect(within(ana).getByText("Lectura")).toBeInTheDocument();
    expect(within(ana).getByText("Inactivo")).toBeInTheDocument();
    expect(within(ana).getAllByText("—").length).toBeGreaterThan(0);

    expect(within(screen.getByRole("row", { name: /bob@example.com/ })).getByText("Lectura y escritura")).toBeInTheDocument();
  });

  it("offers row actions and a new-user button", () => {
    renderTable();
    expect(screen.getByRole("button", { name: "Nuevo usuario" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Editar ana@example.com" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restablecer contraseña de ana@example.com" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desactivar bob@example.com" })).toBeInTheDocument();
  });

  it("does not offer deactivation for yourself or for already inactive users", () => {
    renderTable();
    expect(screen.getByRole("button", { name: "Desactivar admin@example.com" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Desactivar ana@example.com" })).toBeDisabled();
  });

  it("creates a user from the dialog", async () => {
    const user = userEvent.setup();
    actions.createUserAction.mockResolvedValue({ ok: true });
    renderTable();
    await user.click(screen.getByRole("button", { name: "Nuevo usuario" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Email"), "new@example.com");
    await user.type(within(dialog).getByLabelText("Contraseña"), "long-enough-1");
    await user.type(within(dialog).getByLabelText("Nombre (opcional)"), "Nueva");
    await user.click(within(dialog).getByRole("button", { name: "Crear usuario" }));
    await waitFor(() =>
      expect(actions.createUserAction).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "long-enough-1",
        displayName: "Nueva",
        level: "read",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("validates the create form before calling the server", async () => {
    const user = userEvent.setup();
    renderTable();
    await user.click(screen.getByRole("button", { name: "Nuevo usuario" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Crear usuario" }));
    expect(await within(dialog).findByText("Ingrese un email válido.")).toBeInTheDocument();
    expect(actions.createUserAction).not.toHaveBeenCalled();
  });

  it("shows a server field error (duplicate email) in the dialog", async () => {
    const user = userEvent.setup();
    actions.createUserAction.mockResolvedValue({
      ok: false,
      message: "Ya existe un usuario con ese email.",
      fieldErrors: { email: "Ya existe un usuario con ese email." },
    });
    renderTable();
    await user.click(screen.getByRole("button", { name: "Nuevo usuario" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Email"), "ana@example.com");
    await user.type(within(dialog).getByLabelText("Contraseña"), "long-enough-1");
    await user.click(within(dialog).getByRole("button", { name: "Crear usuario" }));
    expect(await within(dialog).findByText("Ya existe un usuario con ese email.")).toBeInTheDocument();
  });

  it("edits name and status of an existing user (email is read-only)", async () => {
    const user = userEvent.setup();
    actions.updateUserAction.mockResolvedValue({ ok: true });
    renderTable();
    await user.click(screen.getByRole("button", { name: "Editar bob@example.com" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("bob@example.com")).toBeInTheDocument();
    const name = within(dialog).getByLabelText("Nombre (opcional)");
    await user.clear(name);
    await user.type(name, "Roberto");
    await user.click(within(dialog).getByRole("checkbox", { name: "Usuario activo" }));
    await user.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(actions.updateUserAction).toHaveBeenCalledWith("u3", {
        displayName: "Roberto",
        level: "write",
        active: false,
      }),
    );
  });

  it("resets a password", async () => {
    const user = userEvent.setup();
    actions.resetPasswordAction.mockResolvedValue({ ok: true });
    renderTable();
    await user.click(screen.getByRole("button", { name: "Restablecer contraseña de ana@example.com" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nueva contraseña"), "brand-new-pass");
    await user.click(within(dialog).getByRole("button", { name: "Restablecer contraseña" }));
    await waitFor(() => expect(actions.resetPasswordAction).toHaveBeenCalledWith("u2", { password: "brand-new-pass" }));
  });

  it("asks for confirmation before deactivating", async () => {
    const user = userEvent.setup();
    actions.deactivateUserAction.mockResolvedValue({ ok: true });
    renderTable();
    await user.click(screen.getByRole("button", { name: "Desactivar bob@example.com" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(actions.deactivateUserAction).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Desactivar" }));
    await waitFor(() => expect(actions.deactivateUserAction).toHaveBeenCalledWith("u3"));
  });

  it("shows the server message when deactivation fails", async () => {
    const user = userEvent.setup();
    actions.deactivateUserAction.mockResolvedValue({ ok: false, message: "No se puede dejar al sistema sin administradores activos." });
    renderTable();
    await user.click(screen.getByRole("button", { name: "Desactivar bob@example.com" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Desactivar" }));
    expect(await within(dialog).findByText("No se puede dejar al sistema sin administradores activos.")).toBeInTheDocument();
  });
});
