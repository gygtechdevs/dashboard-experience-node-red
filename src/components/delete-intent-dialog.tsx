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
import { deleteIntentAction } from "@/app/(dashboard)/knowledge/custom/actions";

interface DeleteIntentDialogProps {
  /** Name of the intent to delete; null keeps the dialog closed. */
  intentName: string | null;
  onClose: () => void;
}

export function DeleteIntentDialog({ intentName, onClose }: DeleteIntentDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setError(null);
    onClose();
  }

  function confirm() {
    if (!intentName) return;
    startTransition(async () => {
      const result = await deleteIntentAction(intentName);
      if (result.ok) {
        toast.success(`Intención "${intentName}" eliminada`);
        close();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <AlertDialog open={intentName !== null} onOpenChange={(open) => !open && !pending && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar intención?</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{intentName}&quot; se eliminará y el asistente dejará de reconocerla. Esta acción no se puede
            deshacer.
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
            {pending ? "Eliminando..." : "Eliminar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
