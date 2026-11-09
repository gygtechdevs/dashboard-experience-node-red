"use client";

import { useMemo, useState } from "react";
import { PencilIcon, PlusIcon, SearchIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteIntentDialog } from "@/components/delete-intent-dialog";
import { ImportIntentsDialog } from "@/components/import-intents-dialog";
import { IntentFormDialog } from "@/components/intent-form-dialog";
import type { Intent, Step } from "@/lib/gateway/schemas";
import { collectTags, filterIntents } from "@/lib/intents/search";

interface IntentsTableProps {
  intents: Intent[];
  /** Null when the steps catalog failed to load. */
  steps: Step[] | null;
  canWrite: boolean;
  canDelete: boolean;
}

type FormTarget = { mode: "closed" } | { mode: "create" } | { mode: "edit"; intent: Intent };

export function IntentsTable({ intents, steps, canWrite, canDelete }: IntentsTableProps) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [form, setForm] = useState<FormTarget>({ mode: "closed" });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const allTags = useMemo(() => collectTags(intents), [intents]);
  // A stale selection (tag removed by an edit) must not hide every row.
  const activeTag = allTags.includes(tag) ? tag : "";
  const visible = useMemo(() => filterIntents(intents, query, activeTag), [intents, query, activeTag]);
  const readOnlyHint = canWrite ? undefined : "Requiere permiso WRITE o ADMIN";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-2 sm:max-w-xl sm:flex-row">
        <div className="relative w-full sm:max-w-sm">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Buscar intenciones"
            placeholder="Buscar por nombre o palabra clave"
            className="pl-8"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {allTags.length > 0 ? (
          <select
            aria-label="Filtrar por etiqueta"
            value={activeTag}
            onChange={(event) => setTag(event.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="">Todas las etiquetas</option>
            {allTags.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!canWrite} title={readOnlyHint} onClick={() => setImporting(true)}>
            <UploadIcon aria-hidden="true" data-icon="inline-start" />
            Importar
          </Button>
          <Button disabled={!canWrite} title={readOnlyHint} onClick={() => setForm({ mode: "create" })}>
            <PlusIcon aria-hidden="true" data-icon="inline-start" />
            Nueva intención
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[22%]">Intención</TableHead>
              <TableHead>Palabras clave</TableHead>
              <TableHead className="hidden w-[16%] md:table-cell">Etiquetas</TableHead>
              <TableHead className="w-24 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((item) => (
              <TableRow key={item.intent} aria-label={item.intent}>
                <TableCell className="align-top">
                  <div className="font-medium">{item.intent}</div>
                  <div className="text-xs text-muted-foreground">{item.initialStep}</div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex flex-wrap gap-1">
                    {item.keywords.map((keyword) => (
                      <Badge key={keyword} variant="secondary">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                  {item.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                  ) : null}
                </TableCell>
                <TableCell className="hidden align-top md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tagName) => (
                      <Badge key={tagName} variant="outline">
                        {tagName}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar ${item.intent}`}
                      title={readOnlyHint ?? "Editar"}
                      disabled={!canWrite}
                      onClick={() => setForm({ mode: "edit", intent: item })}
                    >
                      <PencilIcon aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Eliminar ${item.intent}`}
                      title={canDelete ? "Eliminar" : "Requiere permiso ADMIN"}
                      disabled={!canDelete}
                      onClick={() => setDeleting(item.intent)}
                    >
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {intents.length === 0
              ? "Aún no hay intenciones. Cree la primera para comenzar a enrutar mensajes."
              : `Ninguna intención coincide con "${query.trim()}"${activeTag ? ` con la etiqueta "${activeTag}"` : ""}.`}
          </p>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {visible.length} de {intents.length} intenciones
      </p>

      <IntentFormDialog
        open={form.mode !== "closed"}
        onOpenChange={(open) => !open && setForm({ mode: "closed" })}
        intent={form.mode === "edit" ? form.intent : undefined}
        steps={steps}
        tagSuggestions={allTags}
      />
      <ImportIntentsDialog open={importing} onOpenChange={setImporting} />
      <DeleteIntentDialog intentName={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}
