"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deactivateUserAction } from "@/app/(dashboard)/users/actions";
import type { ManagedUser } from "@/lib/users/schemas";

interface DeactivateUserDialogProps {
  /** User to deactivate; null keeps the dialog closed. */
  user: ManagedUser | null;
  onClose: () => void;
}

export function DeactivateUserDialog({ user, onClose }: DeactivateUserDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setError(null);
    onClose();
  }

  function confirm() {
    if (!user) return;
    startTransition(async () => {
      const result = await deactivateUserAction(user.id);
      if (result.ok) {
        toast.success(`Usuario "${user.email}" desactivado`);
        close();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <AlertDialog open={user !== null} onOpenChange={(open) => !open && !pending && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Desactivar usuario?</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{user?.email}&quot; dejará de poder iniciar sesión. La cuenta no se elimina y puede reactivarse
            desde la edición del usuario.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? "Desactivando..." : "Desactivar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
