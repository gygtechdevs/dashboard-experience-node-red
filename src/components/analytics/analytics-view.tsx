import type { AnalyticsQuery } from "@/lib/analytics/query";
import { channelMeta } from "@/lib/analytics/channels";
import type { AnalyticsChannel, AnalyticsDay, AnalyticsSummary, AnalyticsTag } from "@/lib/gateway/schemas";
import { AnalyticsFilters, type RangePreset } from "./analytics-filters";
import { ChannelDonut } from "./channel-donut";
import { ChannelTable } from "./channel-table";
import { DailyChart } from "./daily-chart";
import { KpiCards, NotTrackedNote } from "./kpi-cards";
import { TopTagsChart } from "./top-tags-chart";

interface AnalyticsViewProps {
  query: AnalyticsQuery;
  presets: RangePreset[];
  summary: AnalyticsSummary;
  channels: AnalyticsChannel[];
  tags: AnalyticsTag[];
  daily: AnalyticsDay[];
}

export function AnalyticsView({ query, presets, summary, channels, tags, daily }: AnalyticsViewProps) {
  const meta = channelMeta(channels, daily);

  return (
    <div className="flex flex-col gap-6">
      <AnalyticsFilters query={query} channels={channels} presets={presets} />

      {summary.totalMessages === 0 ? (
        <div role="status" className="rounded-lg border border-dashed p-10 text-center">
          <h2 className="font-medium">No hay mensajes en este período</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pruebe con un rango de fechas más amplio
            {query.channel ? " o seleccione todos los canales" : ""}. Los mensajes enrutados por el gateway aparecen aquí.
          </p>
        </div>
      ) : (
        <>
          <KpiCards summary={summary} />
          <div className="grid gap-4 lg:grid-cols-3">
            <ChannelDonut channels={channels} meta={meta} />
            <div className="lg:col-span-2">
              <TopTagsChart tags={tags} />
            </div>
          </div>
          <DailyChart daily={daily} meta={meta} />
          <section aria-labelledby="channel-table-heading" className="grid gap-2">
            <h2 id="channel-table-heading" className="font-medium">
              Por canal
            </h2>
            <div className="rounded-xl bg-card p-2 ring-1 ring-foreground/10">
              <ChannelTable channels={channels} />
            </div>
          </section>
          <NotTrackedNote />
        </>
      )}
    </div>
  );
}
