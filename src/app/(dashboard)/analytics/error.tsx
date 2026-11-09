"use client";

import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-6xl rounded-lg border border-destructive/40 bg-destructive/5 p-6" role="alert">
      <h2 className="font-medium">Algo salió mal</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">No se pudo mostrar la analítica.</p>
      <Button variant="outline" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
