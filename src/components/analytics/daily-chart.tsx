"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { ChannelMeta } from "@/lib/analytics/channels";
import { formatCount, formatDay } from "@/lib/analytics/format";
import type { AnalyticsDay } from "@/lib/gateway/schemas";
import { ChartDataTable } from "./chart-data-table";

export function DailyChart({ daily, meta }: { daily: AnalyticsDay[]; meta: ChannelMeta[] }) {
  const config: ChartConfig = Object.fromEntries(meta.map((m) => [m.key, { label: m.label, color: m.color }]));
  // Flatten so every channel is a numeric column, defaulting to 0.
  const data = daily.map((day) => ({
    date: day.date,
    ...Object.fromEntries(meta.map((m) => [m.key, day.byChannel[m.key] ?? 0])),
  }));

  return (
    <Card className="px-4">
      <figure aria-labelledby="daily-title" className="flex flex-col">
        <figcaption id="daily-title" className="mb-3 font-medium">
          Mensajes por día
        </figcaption>
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <BarChart data={data} margin={{ left: 0, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={formatDay} minTickGap={24} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              content={<ChartTooltipContent labelFormatter={formatDay} />}
            />
            {meta.map((m, index) => (
              <Bar
                key={m.key}
                dataKey={m.key}
                stackId="messages"
                fill={`var(--color-${m.key})`}
                radius={index === meta.length - 1 ? [3, 3, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ChartContainer>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {meta.map((m) => (
            <li key={m.key} className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-[2px]" style={{ backgroundColor: m.color }} />
              {m.label}
            </li>
          ))}
        </ul>
        <ChartDataTable caption="Datos de mensajes por día" headers={["Día", ...meta.map((m) => m.label), "Total"]}>
          {daily.map((day) => (
            <tr key={day.date}>
              <td>{formatDay(day.date)}</td>
              {meta.map((m) => (
                <td key={m.key}>{formatCount(day.byChannel[m.key] ?? 0)}</td>
              ))}
              <td>{formatCount(day.total)}</td>
            </tr>
          ))}
        </ChartDataTable>
      </figure>
    </Card>
  );
}
