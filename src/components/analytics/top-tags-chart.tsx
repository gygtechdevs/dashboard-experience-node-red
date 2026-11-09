"use client";

import { Bar, BarChart, LabelList, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCount, formatPct } from "@/lib/analytics/format";
import type { AnalyticsTag } from "@/lib/gateway/schemas";
import { ChartDataTable } from "./chart-data-table";

const config: ChartConfig = { count: { label: "Mensajes", color: "var(--chart-1)" } };

export function TopTagsChart({ tags }: { tags: AnalyticsTag[] }) {
  return (
    <Card className="px-4">
      <figure aria-labelledby="tags-title" className="flex flex-col">
        <figcaption id="tags-title" className="mb-1 font-medium">
          Etiquetas principales
        </figcaption>
        <p className="mb-3 text-xs text-muted-foreground">Proporción de mensajes enrutados a una intención con la etiqueta</p>
        {tags.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hubo coincidencias con intenciones etiquetadas en este período.
          </p>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-44 w-full">
            <BarChart data={tags} layout="vertical" margin={{ left: 8, right: 48 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="tag" type="category" tickLine={false} axisLine={false} width={96} />
              <Tooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={4} barSize={28}>
                <LabelList
                  dataKey="pct"
                  position="right"
                  className="fill-foreground"
                  formatter={(value: unknown) => formatPct(Number(value))}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
        {tags.length > 0 ? (
          <ChartDataTable caption="Datos de etiquetas principales" headers={["Etiqueta", "Mensajes", "Proporción"]}>
            {tags.map((tag) => (
              <tr key={tag.tag}>
                <td>{tag.tag}</td>
                <td>{formatCount(tag.count)}</td>
                <td>{formatPct(tag.pct)}</td>
              </tr>
            ))}
          </ChartDataTable>
        ) : null}
      </figure>
    </Card>
  );
}
