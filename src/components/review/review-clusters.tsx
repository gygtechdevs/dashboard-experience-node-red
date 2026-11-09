"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IntentFormDialog } from "@/components/intent-form-dialog";
import {
  bulkApproveUnmatchedAction,
  bulkRejectUnmatchedAction,
  simulateImpactAction,
} from "@/app/(dashboard)/training/review/actions";
import type {
  BulkReviewResult,
  ClusterMethod,
  ImpactSimulation,
  Step,
  UnmatchedCluster,
  UnmatchedClusters,
} from "@/lib/gateway/schemas";
import { resolvedIds, withoutMembers } from "@/lib/review/clusters";
import { formatDate, formatPercent, plural } from "@/lib/review/format";
import { suggestIntentFromCluster } from "@/lib/review/suggest";
import { ImpactPanel } from "./impact-panel";
import { ReviewTabs } from "./review-tabs";

interface ReviewClustersProps {
  data: UnmatchedClusters;
  /** Names of the existing intents a cluster can be approved into. */
  intents: string[];
  /** Null when the steps catalog could not be loaded. */
  steps: Step[] | null;
  tagSuggestions: string[];
}

interface Creating {
  cluster: UnmatchedCluster;
  ids: string[];
}

const SELECT_CLASS =
  "h-8 max-w-56 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

export function ReviewClusters({ data, intents, steps, tagSuggestions }: ReviewClustersProps) {
  const router = useRouter();
  const [clusters, setClusters] = useState(data.clusters);
  const [creating, setCreating] = useState<Creating | null>(null);
  const suggestion = useMemo(() => (creating ? suggestIntentFromCluster(creating.cluster) : null), [creating]);

  /** Approves `ids` into `intent` and updates the list from the per-item results. Resolves true when everything was approved. */
  async function approveInto(cluster: UnmatchedCluster, intent: string, ids: string[]): Promise<boolean> {
    const result = await bulkApproveUnmatchedAction(intent, ids);
    if (!result.ok) {
      toast.error(result.message);
      if (result.kind === "stale") router.refresh();
      return false;
    }
    const { succeeded, failed, results } = result.data;
    const notEmbedded = results.filter((item) => item.ok && item.embedded === false).length;
    if (succeeded > 0) {
      toast.success(
        `${succeeded === 1 ? "Se aprobó" : "Se aprobaron"} ${plural(succeeded, "mensaje")} en "${intent}".${
          notEmbedded > 0
            ? ` ${plural(notEmbedded, "ejemplo")} ${notEmbedded === 1 ? "aún no está vectorizado" : "aún no están vectorizados"}; ejecute una nueva vectorización en el servicio de intenciones.`
            : ""
        }`,
      );
    }
    if (failed > 0) {
      toast.error(`${plural(failed, "mensaje")} ${failed === 1 ? "no se pudo aprobar" : "no se pudieron aprobar"}. ${failureHint(result.data)}`);
    }
    drop(cluster.id, result.data);
    return failed === 0;
  }

  async function rejectIds(cluster: UnmatchedCluster, ids: string[]): Promise<boolean> {
    const result = await bulkRejectUnmatchedAction(ids);
    if (!result.ok) {
      toast.error(result.message);
      if (result.kind === "stale") router.refresh();
      return false;
    }
    if (result.data.succeeded > 0) toast.success(`${result.data.succeeded === 1 ? "Se rechazó" : "Se rechazaron"} ${plural(result.data.succeeded, "mensaje")}.`);
    if (result.data.failed > 0) {
      toast.error(
        `${plural(result.data.failed, "mensaje")} ${result.data.failed === 1 ? "no se pudo rechazar" : "no se pudieron rechazar"}. ${failureHint(result.data)}`,
      );
    }
    drop(cluster.id, result.data);
    return result.data.failed === 0;
  }

  function drop(clusterId: string, result: BulkReviewResult) {
    const gone = resolvedIds(result);
    setClusters((current) =>
      current.flatMap((cluster) => (cluster.id === clusterId ? (withoutMembers(cluster, gone) ?? []) : [cluster])),
    );
    // Intents and the pending counts changed on the server.
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <ReviewTabs active="clusters" />
      <MethodNote method={data.method} analyzed={data.analyzed} truncated={data.truncated} />

      {intents.length === 0 ? (
        <p role="status" className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          Aún no hay intenciones: cree una abajo a partir de un grupo, o en{" "}
          <Link href="/knowledge/custom" className="underline underline-offset-2">
            Conocimiento
          </Link>
          , antes de aprobar mensajes.
        </p>
      ) : null}

      {clusters.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No hay mensajes pendientes para agrupar: la cola está vacía.
        </div>
      ) : (
        <ul className="grid gap-4">
          {clusters.map((cluster) => (
            <li key={cluster.id}>
              <ClusterCard
                cluster={cluster}
                method={data.method}
                intents={intents}
                onApprove={approveInto}
                onReject={rejectIds}
                onCreateIntent={(ids) => setCreating({ cluster, ids })}
              />
            </li>
          ))}
        </ul>
      )}

      <IntentFormDialog
        open={creating !== null}
        onOpenChange={(open) => {
          if (!open) setCreating(null);
        }}
        steps={steps}
        tagSuggestions={tagSuggestions}
        prefill={suggestion ?? undefined}
        onCreated={async (name) => {
          if (creating) await approveInto(creating.cluster, name, creating.ids);
          setCreating(null);
        }}
      />
    </div>
  );
}

function failureHint(result: BulkReviewResult): string {
  const failure = result.results.find((item) => !item.ok);
  if (!failure || failure.ok) return "";
  return failure.error.endsWith(".") ? failure.error : `${failure.error}.`;
}

function MethodNote({ method, analyzed, truncated }: { method: ClusterMethod; analyzed: number; truncated: boolean }) {
  return (
    <div className="grid gap-1 text-xs text-muted-foreground">
      <p>
        {method === "semantic"
          ? "Agrupados por significado (similitud semántica)."
          : "Agrupados por palabras compartidas porque la vectorización no está disponible. Los grupos pueden ser menos precisos."}
      </p>
      {truncated ? (
        <p>{`Solo se agruparon los ${analyzed} mensajes pendientes más frecuentes; hay más esperando en la pestaña Pendientes.`}</p>
      ) : null}
    </div>
  );
}

type Simulation =
  | { key: string; status: "loading" }
  | { key: string; status: "done"; impact: ImpactSimulation }
  | { key: string; status: "error"; message: string };

interface ClusterCardProps {
  cluster: UnmatchedCluster;
  method: ClusterMethod;
  intents: string[];
  onApprove: (cluster: UnmatchedCluster, intent: string, ids: string[]) => Promise<boolean>;
  onReject: (cluster: UnmatchedCluster, ids: string[]) => Promise<boolean>;
  onCreateIntent: (ids: string[]) => void;
}

function ClusterCard({ cluster, method, intents, onApprove, onReject, onCreateIntent }: ClusterCardProps) {
  const titleId = `cluster-${cluster.id}-title`;
  const membersId = `cluster-${cluster.id}-members`;
  const nearest = cluster.nearestIntent;
  const [intent, setIntent] = useState(nearest && intents.includes(nearest.intent) ? nearest.intent : "");
  const [expanded, setExpanded] = useState(false);
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set());
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [busy, setBusy] = useState<"simulate" | "approve" | "reject" | null>(null);
  const [confirmingReject, setConfirmingReject] = useState(false);

  const ids = cluster.members.filter((member) => !unchecked.has(member.id)).map((member) => member.id);
  // A simulation only describes the exact intent + selection it ran for.
  const key = `${intent}|${ids.join(",")}`;
  const current = simulation?.key === key ? simulation : null;
  const hasSelection = ids.length > 0;

  async function simulate() {
    setBusy("simulate");
    setSimulation({ key, status: "loading" });
    try {
      const result = await simulateImpactAction(intent, ids);
      setSimulation(
        result.ok
          ? { key, status: "done", impact: result.data }
          : { key, status: "error", message: result.message },
      );
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    setBusy("approve");
    try {
      await onApprove(cluster, intent, ids);
      setSimulation(null);
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    setBusy("reject");
    try {
      await onReject(cluster, ids);
    } finally {
      setBusy(null);
      setConfirmingReject(false);
    }
  }

  function toggle(id: string) {
    setUnchecked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmingReject(false);
  }

  const similarityLabel =
    nearest === null ? null : `${formatPercent(nearest.similarity)} ${method === "semantic" ? "de similitud" : "de palabras en común"}`;

  return (
    <article aria-labelledby={titleId} aria-busy={busy !== null} className="grid gap-3 rounded-lg border p-4">
      <header className="grid gap-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 id={titleId} className="min-w-0 font-medium break-words">
            {cluster.representativeText}
          </h3>
          <span className="shrink-0 rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground tabular-nums">
            {plural(cluster.size, "mensaje")}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {nearest ? (
            <>
              Intención más cercana: <strong className="text-foreground">{nearest.intent}</strong>{" "}
              <span>{similarityLabel}</span>
            </>
          ) : (
            "Aún no hay una intención similar: puede hacer falta una nueva."
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {`Primera vez: ${formatDate(cluster.firstSeenAt)} · Última vez: ${formatDate(cluster.lastSeenAt)}`}
        </p>
      </header>

      <div>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          aria-controls={membersId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Ocultar mensajes" : `Mostrar mensajes (${cluster.members.length})`}
        </Button>
        {expanded ? (
          <ul id={membersId} className="mt-1 grid gap-1 rounded-lg border bg-muted/20 p-2">
            {cluster.members.map((member) => (
              <li key={member.id}>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0"
                    checked={!unchecked.has(member.id)}
                    disabled={busy !== null}
                    onChange={() => toggle(member.id)}
                  />
                  <span className="min-w-0 break-words">{member.maskedText}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                    {`×${member.occurrences}`}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Intención de destino"
          value={intent}
          disabled={busy !== null || intents.length === 0}
          onChange={(event) => setIntent(event.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">Seleccionar intención...</option>
          {intents.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <Button size="sm" disabled={busy !== null || !intent || !hasSelection} onClick={simulate}>
          {busy === "simulate" ? "Simulando..." : "Simular impacto"}
        </Button>
        <Button size="sm" variant="outline" disabled={busy !== null || !hasSelection} onClick={() => onCreateIntent(ids)}>
          Crear nueva intención
        </Button>
        {confirmingReject ? (
          <span className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirmar rechazo">
            <span className="text-sm">{`¿Rechazar ${plural(ids.length, "mensaje")} como ruido?`}</span>
            <Button size="sm" variant="destructive" disabled={busy !== null} onClick={reject}>
              {busy === "reject" ? "Rechazando..." : "Confirmar rechazo"}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setConfirmingReject(false)}>
              Cancelar
            </Button>
          </span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null || !hasSelection}
            onClick={() => setConfirmingReject(true)}
          >
            {`Rechazar ${plural(ids.length, "mensaje")}`}
          </Button>
        )}
      </div>

      {current?.status === "loading" ? (
        <p role="status" className="text-sm text-muted-foreground">
          Reproduciendo los mensajes recientes con los nuevos ejemplos...
        </p>
      ) : null}
      {current?.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {current.message}
        </p>
      ) : null}
      {current?.status === "done" ? (
        <>
          <ImpactPanel impact={current.impact} />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={busy !== null} onClick={approve}>
              {busy === "approve" ? "Aprobando..." : `Aprobar ${plural(ids.length, "mensaje")} en ${intent}`}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setSimulation(null)}>
              Descartar simulación
            </Button>
          </div>
        </>
      ) : null}
    </article>
  );
}
