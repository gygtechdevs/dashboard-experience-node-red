"use client";

import { useState } from "react";
import { KeyRoundIcon, PencilIcon, PlusIcon, UserXIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeactivateUserDialog } from "@/components/deactivate-user-dialog";
import { ResetPasswordDialog } from "@/components/reset-password-dialog";
import { UserFormDialog } from "@/components/user-form-dialog";
import { formatDate } from "@/lib/review/format";
import { ACCESS_LABELS, levelFromPermissions } from "@/lib/users/access";
import type { ManagedUser } from "@/lib/users/schemas";

interface UsersTableProps {
  users: ManagedUser[];
  /** Session user id: that row cannot be deactivated or demoted from here. */
  currentUserId: string;
}

type FormTarget = { mode: "closed" } | { mode: "create" } | { mode: "edit"; user: ManagedUser };

export function UsersTable({ users, currentUserId }: UsersTableProps) {
  const [form, setForm] = useState<FormTarget>({ mode: "closed" });
  const [resetting, setResetting] = useState<ManagedUser | null>(null);
  const [deactivating, setDeactivating] = useState<ManagedUser | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setForm({ mode: "create" })}>
          <PlusIcon aria-hidden="true" data-icon="inline-start" />
          Nuevo usuario
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead className="hidden md:table-cell">Nombre</TableHead>
              <TableHead>Acceso</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden lg:table-cell">Último acceso</TableHead>
              <TableHead className="w-32 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((item) => {
              const isSelf = item.id === currentUserId;
              return (
                <TableRow key={item.id} aria-label={item.email}>
                  <TableCell className="font-medium">{item.email}</TableCell>
                  <TableCell className="hidden md:table-cell">{item.displayName ?? "—"}</TableCell>
                  <TableCell>{ACCESS_LABELS[levelFromPermissions(item.permissions)]}</TableCell>
                  <TableCell>
                    <Badge variant={item.active ? "secondary" : "outline"}>{item.active ? "Activo" : "Inactivo"}</Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {item.lastLoginAt ? formatDate(item.lastLoginAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${item.email}`}
                        title="Editar"
                        onClick={() => setForm({ mode: "edit", user: item })}
                      >
                        <PencilIcon aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Restablecer contraseña de ${item.email}`}
                        title="Restablecer contraseña"
                        onClick={() => setResetting(item)}
                      >
                        <KeyRoundIcon aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Desactivar ${item.email}`}
                        title={
                          isSelf ? "No puede desactivar su propia cuenta" : item.active ? "Desactivar" : "Ya está inactivo"
                        }
                        disabled={isSelf || !item.active}
                        onClick={() => setDeactivating(item)}
                      >
                        <UserXIcon aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {users.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Aún no hay usuarios.</p>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {users.length} {users.length === 1 ? "usuario" : "usuarios"}
      </p>

      <UserFormDialog
        open={form.mode !== "closed"}
        onOpenChange={(open) => !open && setForm({ mode: "closed" })}
        user={form.mode === "edit" ? form.user : undefined}
        isSelf={form.mode === "edit" && form.user.id === currentUserId}
      />
      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
      <DeactivateUserDialog user={deactivating} onClose={() => setDeactivating(null)} />
    </div>
  );
}
