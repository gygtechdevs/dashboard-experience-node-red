"use client";

import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCount, formatPct } from "@/lib/analytics/format";
import type { ChannelMeta } from "@/lib/analytics/channels";
import type { AnalyticsChannel } from "@/lib/gateway/schemas";

export function ChannelDonut({ channels, meta }: { channels: AnalyticsChannel[]; meta: ChannelMeta[] }) {
  const byKey = new Map(meta.map((m) => [m.key, m]));
  const total = channels.reduce((sum, c) => sum + c.messages, 0);
  const config: ChartConfig = Object.fromEntries(meta.map((m) => [m.key, { label: m.label, color: m.color }]));
  const data = channels.map((c) => ({ key: c.channel, name: byKey.get(c.channel)?.label ?? c.channel, value: c.messages }));

  return (
    <Card className="px-4">
      <figure aria-labelledby="donut-title" className="flex flex-col gap-3">
        <figcaption id="donut-title" className="font-medium">
          Mensajes por canal
        </figcaption>
        <div className="relative">
          <ChartContainer config={config} className="mx-auto aspect-square max-h-56">
            <PieChart>
              <Tooltip content={<ChartTooltipContent />} />
              <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" strokeWidth={2}>
                {data.map((entry) => (
                  <Cell key={entry.key} fill={`var(--color-${entry.key})`} stroke="var(--card)" />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
            <span className="text-2xl font-semibold tabular-nums">{formatCount(total)}</span>
            <span className="text-xs text-muted-foreground">mensajes</span>
          </div>
        </div>
        {/* The legend doubles as the text alternative: every slice with its value and share. */}
        <ul className="grid gap-1.5 text-sm">
          {data.map((entry) => (
            <li key={entry.key} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: byKey.get(entry.key)?.color }}
              />
              <span>{entry.name}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">
                {formatCount(entry.value)} ({total === 0 ? formatPct(0) : formatPct((entry.value / total) * 100)})
              </span>
            </li>
          ))}
        </ul>
      </figure>
    </Card>
  );
}
