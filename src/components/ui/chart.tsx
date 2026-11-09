"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"
import { cn } from "@/lib/utils"

/** Maps a data key to a label and a theme colour (use `var(--chart-n)` tokens, never raw colours). */
export type ChartConfig = Record<string, { label?: React.ReactNode; color?: string }>

interface ChartContextValue {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextValue | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) throw new Error("useChart must be used within a <ChartContainer />")
  return context
}

/**
 * Responsive wrapper. Every config entry becomes a `--color-<key>` CSS variable so series can be
 * painted with `fill="var(--color-<key>)"`.
 */
function ChartContainer({
  config,
  className,
  children,
  style,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  config: ChartConfig
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"]
}) {
  const colors = Object.fromEntries(
    Object.entries(config)
      .filter(([, value]) => value.color)
      .map(([key, value]) => [`--color-${key}`, value.color])
  ) as React.CSSProperties

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        style={{ ...colors, ...style }}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/60 [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-surface]:outline-hidden",
          className
        )}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

interface TooltipItem {
  name?: string | number
  dataKey?: string | number
  value?: unknown
  color?: string
  payload?: { fill?: string }
}

/** Tooltip body using the chart config for labels. Pass as `<Tooltip content={<ChartTooltipContent />} />`. */
function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean
  payload?: ReadonlyArray<TooltipItem>
  label?: unknown
  labelFormatter?: (label: string) => string
}) {
  const { config } = useChart()
  if (!active || !payload?.length) return null

  const heading = label === undefined || label === null ? null : String(label)

  return (
    <div className="grid min-w-32 gap-1.5 rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-xl">
      {heading ? <div className="font-medium">{labelFormatter ? labelFormatter(heading) : heading}</div> : null}
      <ul className="grid gap-1">
        {payload.map((item, index) => {
          const key = String(item.dataKey ?? item.name ?? index)
          const entry = config[key] ?? config[String(item.name ?? "")]
          const color = item.payload?.fill ?? item.color
          return (
            <li key={`${key}-${index}`} className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
              <span className="text-muted-foreground">{entry?.label ?? item.name}</span>
              <span className="ml-auto font-mono font-medium tabular-nums">
                {typeof item.value === "number" ? item.value.toLocaleString("es") : String(item.value ?? "")}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export { ChartContainer, ChartTooltipContent }
