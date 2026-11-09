import { Suspense } from "react";
import type { Metadata } from "next";
import { AnalyticsSkeleton } from "@/components/analytics/analytics-skeleton";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import type { RangePreset } from "@/components/analytics/analytics-filters";
import {
  PRESET_DAYS,
  buildAnalyticsHref,
  parseAnalyticsParams,
  presetRange,
  type SearchParamsInput,
} from "@/lib/analytics/query";
import { GatewayError } from "@/lib/gateway/client";
import { describeGatewayError, withGateway } from "@/lib/gateway/server";

export const metadata: Metadata = { title: "Analítica | Node-RED Dashboard" };

export default function AnalyticsPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Analítica</h1>
        <p className="text-sm text-muted-foreground">
          Mensajes enrutados por el gateway. Los días se cuentan en UTC; las conversaciones están anonimizadas.
        </p>
      </header>
      {/* Request-time data (search params, cookie, gateway) streams in behind a Suspense boundary. */}
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AnalyticsSection({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const params = await searchParams; // request-time access first: `new Date()` is only allowed after it
  const today = new Date();
  const query = parseAnalyticsParams(params, today);

  let data;
  try {
    data = await withGateway(async (client) => {
      const [summary, channels, tags, daily] = await Promise.all([
        client.getAnalyticsSummary(query),
        client.getAnalyticsByChannel(query),
        client.getAnalyticsTopTags(query),
        client.getAnalyticsDaily(query),
      ]);
      return { summary, channels, tags, daily };
    });
  } catch (error) {
    // withGateway redirects on 401 by throwing NEXT_REDIRECT; let anything else that is not a gateway error propagate.
    if (!(error instanceof GatewayError)) throw error;
    return (
      <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
        <h2 className="font-medium">No se pudo cargar la analítica</h2>
        <p className="mt-1 text-sm text-muted-foreground">{describeGatewayError(error)}</p>
      </div>
    );
  }

  const presets: RangePreset[] = PRESET_DAYS.map((days) => {
    const range = presetRange(days, today);
    return {
      days,
      href: buildAnalyticsHref({ ...range, channel: query.channel }),
      active: range.from === query.from && range.to === query.to,
    };
  });

  return <AnalyticsView query={query} presets={presets} {...data} />;
}
