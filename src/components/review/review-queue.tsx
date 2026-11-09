"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  approveUnmatchedAction,
  loadMoreUnmatchedAction,
  rejectUnmatchedAction,
} from "@/app/(dashboard)/training/review/actions";
import type { ApproveUnmatchedResult, UnmatchedItem, UnmatchedStatus } from "@/lib/gateway/schemas";
import { STATUS_PLURAL, formatDate } from "@/lib/review/format";
import { ReviewTabs } from "./review-tabs";

interface ReviewQueueProps {
  items: UnmatchedItem[];
  nextCursor: string | null;
  status: UnmatchedStatus;
  /** Names of the existing intents a message can be approved into. */
  intents: string[];
}

export function ReviewQueue({ items: initialItems, nextCursor: initialCursor, status, intents }: ReviewQueueProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [approved, setApproved] = useState<Record<string, ApproveUnmatchedResult>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const drop = (id: string) => setItems((current) => current.filter((item) => item.id !== id));

  async function approve(id: string) {
    const intent = choices[id];
    if (!intent) return;
    setBusyId(id);
    try {
      const result = await approveUnmatchedAction(id, intent);
      if (result.ok) {
        setApproved((current) => ({ ...current, [id]: result.data }));
        toast.success(`Aprobado como ejemplo de "${result.data.intent}"`);
      } else {
        toast.error(result.message);
        if (result.kind === "stale") {
          drop(id);
          router.refresh();
        }
      }
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    setBusyId(id);
    try {
      const result = await rejectUnmatchedAction(id);
      if (result.ok) {
        drop(id);
        toast.success("Mensaje rechazado");
      } else {
        toast.error(result.message);
        if (result.kind === "stale") {
          drop(id);
          router.refresh();
        }
      }
    } finally {
      setBusyId(null);
    }
  }

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const result = await loadMoreUnmatchedAction(status, cursor);
      if (result.ok) {
        setItems((current) => {
          const known = new Set(current.map((item) => item.id));
          return [...current, ...result.data.items.filter((item) => !known.has(item.id))];
        });
        setCursor(result.data.nextCursor);
      } else {
        toast.error(result.message);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  const pendingView = status === "pending";

  return (
    <div className="flex flex-col gap-4">
      <ReviewTabs active={status} />

      {pendingView && intents.length === 0 ? (
        <p role="status" className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          Aún no hay intenciones: cree una en{" "}
          <Link href="/knowledge/custom" className="underline underline-offset-2">
            Conocimiento
          </Link>{" "}
          antes de aprobar mensajes.
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          {pendingView ? "La cola está vacía: no hay nada para revisar por ahora." : `No hay mensajes ${STATUS_PLURAL[status]}.`}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mensaje</TableHead>
                <TableHead className="w-20 text-right">Vistas</TableHead>
                <TableHead className="hidden w-44 md:table-cell">Primera / última vez</TableHead>
                <TableHead className="w-[34%]">{pendingView ? "Acción" : "Resolución"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const result = approved[item.id];
                const busy = busyId === item.id;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-normal break-words">{item.maskedText}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.occurrences}</TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      <div>{formatDate(item.firstSeenAt)}</div>
                      <div>{formatDate(item.lastSeenAt)}</div>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {result ? (
                        <div className="text-sm">
                          <p>
                            Aprobado como <strong>{result.intent}</strong>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {result.embedded
                              ? "Ejemplo vectorizado y activo."
                              : "Aún sin vectorizar: el ejemplo se guardó, pero no se usa para la coincidencia hasta que se vuelva a vectorizar (POST /admin/intent-examples/reembed en el servicio de intenciones)."}
                          </p>
                        </div>
                      ) : pendingView ? (
                        intents.length === 0 ? (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => reject(item.id)}>
                            Rechazar
                          </Button>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              aria-label="Intención en la que aprobar"
                              value={choices[item.id] ?? ""}
                              disabled={busy}
                              onChange={(event) =>
                                setChoices((current) => ({ ...current, [item.id]: event.target.value }))
                              }
                              className="h-8 max-w-48 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                            >
                              <option value="">Seleccionar intención...</option>
                              {intents.map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </select>
                            <Button size="sm" disabled={busy || !choices[item.id]} onClick={() => approve(item.id)}>
                              Aprobar
                            </Button>
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => reject(item.id)}>
                              Rechazar
                            </Button>
                          </div>
                        )
                      ) : (
                        <span className="text-sm">{item.status === "approved" ? item.resolvedIntent : "Rechazado"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {cursor ? (
        <div className="flex justify-center">
          <Button variant="outline" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? "Cargando..." : "Cargar más"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
