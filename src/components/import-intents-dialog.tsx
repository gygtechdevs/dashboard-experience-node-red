"use client";

import { useId, useState, type ChangeEvent } from "react";
import { DownloadIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { importIntentsAction } from "@/app/(dashboard)/knowledge/custom/actions";
import {
  IMPORT_BATCH_SIZE,
  IMPORT_TEMPLATE_CSV,
  IMPORT_TEMPLATE_JSON,
  MAX_IMPORT_ROWS,
  detectImportFormat,
  parseImportText,
  summarizeChecks,
  validateImportRows,
  type ImportCheck,
} from "@/lib/intents/import";
import type { ImportRowResult } from "@/lib/intents/import-run";

const MAX_FILE_BYTES = 1024 * 1024;

interface ImportIntentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportIntentsDialog({ open, onOpenChange }: ImportIntentsDialogProps) {
  // Remount the content whenever the dialog opens so a previous file never lingers.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <ImportContent onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

function downloadText(filename: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function messageOf(check: Extract<ImportCheck, { status: "invalid" }>): string {
  return Object.values(check.errors).join(" ");
}

function ImportContent({ onClose }: { onClose: () => void }) {
  const uid = useId();
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [checks, setChecks] = useState<ImportCheck[]>([]);
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<ImportRowResult[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const summary = summarizeChecks(checks);
  const finished = results !== null;

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setChecks([]);
    setFileError(null);
    setFileName(file?.name ?? null);
    if (!file) return;

    const format = detectImportFormat(file.name);
    if (!format) {
      setFileError("Archivo no admitido. Elija un archivo CSV o JSON.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError("El archivo es demasiado grande (máximo 1 MB).");
      return;
    }
    const parsed = parseImportText(await file.text(), format);
    if (!parsed.ok) {
      setFileError(parsed.error);
      return;
    }
    setChecks(validateImportRows(parsed.rows));
  }

  async function handleImport() {
    const rows = checks.flatMap((check) => (check.status === "valid" ? [check.values] : []));
    const collected: ImportRowResult[] = [];
    setRunError(null);
    setRunning({ done: 0, total: rows.length });

    try {
      for (let start = 0; start < rows.length; start += IMPORT_BATCH_SIZE) {
        const outcome = await importIntentsAction(rows.slice(start, start + IMPORT_BATCH_SIZE));
        if (!outcome.ok) {
          setRunError(outcome.message);
          break;
        }
        collected.push(...outcome.results);
        setRunning({ done: collected.length, total: rows.length });
      }
    } catch {
      setRunError("La importación se interrumpió. Verifique qué filas se crearon antes de reintentar.");
    }
    setRunning(null);
    setResults(collected);
  }

  const created = results?.filter((r) => r.status === "created").length ?? 0;
  const duplicates = results?.filter((r) => r.status === "duplicate").length ?? 0;
  const failed = (results?.length ?? 0) - created - duplicates;

  return (
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Importar intenciones</DialogTitle>
        <DialogDescription>
          Cargue un archivo CSV o JSON con hasta {MAX_IMPORT_ROWS} intenciones. Las filas se validan primero aquí y solo
          se crean las válidas.
        </DialogDescription>
      </DialogHeader>

      {!finished ? (
        <div className="grid gap-4">
          <div className="grid gap-1.5 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Columnas del CSV:</span> intent, initialStep, keywords,
              description (opcional), tags (opcional). Las palabras clave y las etiquetas se separan con <code>|</code>.
            </p>
            <p>
              <span className="font-medium text-foreground">JSON:</span> un arreglo de objetos con las mismas claves;
              keywords y tags pueden ser arreglos.
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadText("intents-template.csv", IMPORT_TEMPLATE_CSV, "text/csv")}
              >
                <DownloadIcon aria-hidden="true" data-icon="inline-start" />
                Descargar plantilla CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadText("intents-template.json", IMPORT_TEMPLATE_JSON, "application/json")}
              >
                <DownloadIcon aria-hidden="true" data-icon="inline-start" />
                Descargar plantilla JSON
              </Button>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`${uid}-file`}>Elija un archivo CSV o JSON</Label>
            <input
              id={`${uid}-file`}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              disabled={running !== null}
              onChange={handleFile}
              className="text-sm file:mr-3 file:rounded-md file:border file:bg-transparent file:px-2.5 file:py-1 file:text-sm"
            />
          </div>

          {fileError ? (
            <p role="alert" className="text-sm text-destructive">
              {fileError}
            </p>
          ) : null}

          {checks.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-sm" aria-live="polite">
                {fileName ? `${fileName}: ` : ""}
                Filas: {summary.total} · Válidas: {summary.valid} · Con errores: {summary.invalid}
              </p>
              <div className="max-h-72 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">Fila</TableHead>
                      <TableHead>Intención</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checks.map((check) => (
                      <TableRow key={check.index} aria-label={`Fila ${check.index}`}>
                        <TableCell className="align-top">{check.index}</TableCell>
                        <TableCell className="align-top">
                          <div className="font-medium">{check.intent || "(sin nombre)"}</div>
                          {check.status === "valid" ? (
                            <div className="text-xs text-muted-foreground">
                              {check.values.initialStep} · {check.values.keywords.join(", ")}
                              {check.values.tags.length > 0 ? ` · etiquetas: ${check.values.tags.join(", ")}` : ""}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-top">
                          {check.status === "valid" ? (
                            <Badge variant="secondary">Válida</Badge>
                          ) : (
                            <span className="text-xs text-destructive">{messageOf(check)}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-2">
          <p className="text-sm font-medium" aria-live="polite">
            Creadas: {created} · Duplicadas: {duplicates} · Con error: {failed}
          </p>
          {runError ? (
            <p role="alert" className="text-sm text-destructive">
              {runError}
            </p>
          ) : null}
          <div className="max-h-72 overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Intención</TableHead>
                  <TableHead>Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, position) => (
                  <TableRow key={`${position}-${result.intent}`} aria-label={result.intent || `Fila ${position + 1}`}>
                    <TableCell className="align-top font-medium">{result.intent}</TableCell>
                    <TableCell className="align-top text-xs">
                      {result.status === "created" ? "Creada" : null}
                      {result.status === "duplicate" ? "Duplicada: ya existe" : null}
                      {result.status === "error" ? (
                        <span className="text-destructive">Error: {result.message}</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {!finished && runError ? (
        <p role="alert" className="text-sm text-destructive">
          {runError}
        </p>
      ) : null}

      <DialogFooter>
        {finished ? (
          <Button type="button" onClick={onClose}>
            Listo
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onClose} disabled={running !== null}>
              Cancelar
            </Button>
            <Button type="button" disabled={summary.valid === 0 || running !== null} onClick={handleImport}>
              {running
                ? `Importando ${running.done} de ${running.total}...`
                : checks.length === 0
                  ? "Importar"
                  : `Importar ${summary.valid} ${summary.valid === 1 ? "fila válida" : "filas válidas"}`}
            </Button>
          </>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
