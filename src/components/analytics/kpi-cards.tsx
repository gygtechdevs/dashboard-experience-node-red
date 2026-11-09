import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCount, formatPct, formatRate } from "@/lib/analytics/format";
import type { AnalyticsSummary } from "@/lib/gateway/schemas";

function Delta({ summary }: { summary: AnalyticsSummary }) {
  const { deltaPct } = summary.previousPeriod;
  if (deltaPct === null) {
    return <p className="text-xs text-muted-foreground">No hubo mensajes en el período anterior</p>;
  }
  const Icon = deltaPct > 0 ? ArrowUpIcon : deltaPct < 0 ? ArrowDownIcon : MinusIcon;
  const sign = deltaPct > 0 ? "+" : "";
  return (
    <p className="flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="size-3.5" aria-hidden="true" />
      <span>
        {sign}
        {formatPct(deltaPct)} frente al período anterior ({formatCount(summary.previousPeriod.totalMessages)})
      </span>
    </p>
  );
}

function Kpi({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <Card size="sm" className="px-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      {children}
    </Card>
  );
}

export function KpiCards({ summary }: { summary: AnalyticsSummary }) {
  return (
    <section aria-labelledby="kpi-heading"className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <h2 id="kpi-heading" className="sr-only">
        Métricas clave
      </h2>
      <Kpi label="Total de mensajes" value={formatCount(summary.totalMessages)}>
        <Delta summary={summary} />
      </Kpi>
      <Kpi label="Conversaciones únicas" value={formatCount(summary.uniqueConversations)} />
      <Kpi label="Asociados a una intención" value={formatRate(summary.matchedRate)}>
        <p className="text-xs text-muted-foreground">Proporción de mensajes que coincidieron con una intención</p>
      </Kpi>
      <Kpi label="Tasa de error" value={formatRate(summary.errorRate)}>
        <p className="text-xs text-muted-foreground">Mensajes cuya llamada a Node-RED falló</p>
      </Kpi>
    </section>
  );
}

/** Metrics the reference design shows but for which no data is collected. */
export function NotTrackedNote() {
  return (
    <p role="note" className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">Aún sin seguimiento:</span> la satisfacción del cliente y las transferencias a un
      agente humano no se registran, por lo que no se muestran aquí.
    </p>
  );
}
