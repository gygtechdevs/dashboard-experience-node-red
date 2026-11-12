"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createUserAction, updateUserAction } from "@/app/(dashboard)/users/actions";
import { ACCESS_LABELS, ACCESS_LEVELS, levelFromPermissions, type AccessLevel } from "@/lib/users/access";
import {
  MAX_DISPLAY_NAME_LENGTH,
  createUserFormSchema,
  updateUserFormSchema,
  userFieldErrors,
  type UserFieldErrors,
} from "@/lib/users/form";
import type { ManagedUser } from "@/lib/users/schemas";

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** User being edited; undefined creates a new one. */
  user?: ManagedUser;
  /** Editing yourself: level and status are locked so an admin cannot lock themselves out. */
  isSelf?: boolean;
}

const LEVEL_ITEMS = ACCESS_LEVELS.map((value) => ({ value, label: ACCESS_LABELS[value] }));

export function UserFormDialog({ open, onOpenChange, user, isSelf = false }: UserFormDialogProps) {
  // Remount the form whenever the dialog opens or the target changes so state starts fresh.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <UserForm key={user?.id ?? "new"} user={user} isSelf={isSelf} onClose={() => onOpenChange(false)} />
      ) : null}
    </Dialog>
  );
}

function UserForm({ user, isSelf, onClose }: { user?: ManagedUser; isSelf: boolean; onClose: () => void }) {
  const uid = useId();
  const editing = user !== undefined;
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [level, setLevel] = useState<AccessLevel>(user ? levelFromPermissions(user.permissions) : "read");
  const [active, setActive] = useState(user?.active ?? true);
  const [errors, setErrors] = useState<UserFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const values = editing ? { displayName, level, active } : { email, password, displayName, level };
    const parsed = (editing ? updateUserFormSchema : createUserFormSchema).safeParse(values);
    if (!parsed.success) {
      setErrors(userFieldErrors(parsed.error));
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = editing ? await updateUserAction(user.id, values) : await createUserAction(values);
      if (result.ok) {
        toast.success(editing ? "Usuario actualizado" : "Usuario creado");
        onClose();
        return;
      }
      setErrors(result.fieldErrors ?? {});
      setFormError(Object.keys(result.fieldErrors ?? {}).length > 0 ? null : result.message);
    });
  }

  const describe = (field: keyof UserFieldErrors) => (errors[field] ? `${uid}-${field}-error` : undefined);

  return (
    <DialogContent className="sm:max-w-lg">
      <form onSubmit={handleSubmit} noValidate className="grid gap-4">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
          <DialogDescription>
            El nivel de acceso define lo que la persona puede hacer en el dashboard y el gateway.
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <div className="grid gap-1">
            <span className="text-sm font-medium">Email</span>
            <p className="text-sm">{user.email}</p>
            <p className="text-xs text-muted-foreground">El email no se puede cambiar después de la creación.</p>
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor={`${uid}-email`}>Email</Label>
            <Input
              id={`${uid}-email`}
              type="email"
              value={email}
              disabled={pending}
              autoComplete="off"
              aria-invalid={!!errors.email}
              aria-describedby={describe("email")}
              onChange={(event) => setEmail(event.target.value)}
            />
            <FieldError id={`${uid}-email-error`} message={errors.email} />
          </div>
        )}

        {editing ? null : (
          <div className="grid gap-1.5">
            <Label htmlFor={`${uid}-password`}>Contraseña</Label>
            <Input
              id={`${uid}-password`}
              type="password"
              value={password}
              disabled={pending}
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby={describe("password")}
              onChange={(event) => setPassword(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres. La persona podrá cambiarla luego.</p>
            <FieldError id={`${uid}-password-error`} message={errors.password} />
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-name`}>Nombre (opcional)</Label>
          <Input
            id={`${uid}-name`}
            value={displayName}
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            disabled={pending}
            autoComplete="off"
            aria-invalid={!!errors.displayName}
            aria-describedby={describe("displayName")}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <FieldError id={`${uid}-displayName-error`} message={errors.displayName} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-level`}>Nivel de acceso</Label>
          <Select
            value={level}
            items={LEVEL_ITEMS}
            onValueChange={(value) => setLevel(value as AccessLevel)}
            disabled={pending || isSelf}
          >
            <SelectTrigger
              id={`${uid}-level`}
              className="w-full"
              aria-invalid={!!errors.level}
              aria-describedby={describe("level")}
            >
              <SelectValue placeholder="Seleccione un nivel" />
            </SelectTrigger>
            <SelectContent>
              {LEVEL_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isSelf ? (
            <p className="text-xs text-muted-foreground">No puede cambiar su propio nivel de acceso.</p>
          ) : null}
          <FieldError id={`${uid}-level-error`} message={errors.level} />
        </div>

        {editing ? (
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <input
                id={`${uid}-active`}
                type="checkbox"
                checked={active}
                disabled={pending || isSelf}
                onChange={(event) => setActive(event.target.checked)}
                className="size-4 rounded border-input accent-primary"
              />
              <Label htmlFor={`${uid}-active`}>Usuario activo</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {isSelf
                ? "No puede desactivar su propia cuenta."
                : "Un usuario inactivo no puede iniciar sesión."}
            </p>
          </div>
        ) : null}

        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : editing ? "Guardar cambios" : "Crear usuario"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}
