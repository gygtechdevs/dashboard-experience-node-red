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
import { resetPasswordAction } from "@/app/(dashboard)/users/actions";
import { resetPasswordFormSchema, userFieldErrors } from "@/lib/users/form";
import type { ManagedUser } from "@/lib/users/schemas";

interface ResetPasswordDialogProps {
  /** User whose password is reset; null keeps the dialog closed. */
  user: ManagedUser | null;
  onClose: () => void;
}

export function ResetPasswordDialog({ user, onClose }: ResetPasswordDialogProps) {
  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      {user ? <ResetPasswordForm key={user.id} user={user} onClose={onClose} /> : null}
    </Dialog>
  );
}

function ResetPasswordForm({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const uid = useId();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = resetPasswordFormSchema.safeParse({ password });
    if (!parsed.success) {
      setError(userFieldErrors(parsed.error).password ?? null);
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await resetPasswordAction(user.id, { password });
      if (result.ok) {
        toast.success("Contraseña restablecida");
        onClose();
        return;
      }
      setError(result.fieldErrors?.password ?? null);
      setFormError(result.fieldErrors?.password ? null : result.message);
    });
  }

  return (
    <DialogContent className="sm:max-w-md">
      <form onSubmit={handleSubmit} noValidate className="grid gap-4">
        <DialogHeader>
          <DialogTitle>Restablecer contraseña</DialogTitle>
          <DialogDescription>Defina una nueva contraseña para {user.email}.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-password`}>Nueva contraseña</Label>
          <Input
            id={`${uid}-password`}
            type="password"
            value={password}
            disabled={pending}
            autoComplete="new-password"
            aria-invalid={!!error}
            aria-describedby={error ? `${uid}-password-error` : undefined}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">Mínimo 8 caracteres. Se le pedirá cambiarla al iniciar sesión.</p>
          {error ? (
            <p id={`${uid}-password-error`} role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>

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
            {pending ? "Guardando..." : "Restablecer contraseña"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
