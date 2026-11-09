import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AnalyticsQuery } from "@/lib/analytics/query";
import type { AnalyticsChannel } from "@/lib/gateway/schemas";

export interface RangePreset {
  days: number;
  href: string;
  active: boolean;
}

const fieldClass =
  "h-8 rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/**
 * Plain GET form: the filters are the URL (shareable, back-button friendly) and work without
 * client-side JavaScript.
 */
export function AnalyticsFilters({
  query,
  channels,
  presets,
}: {
  query: AnalyticsQuery;
  channels: AnalyticsChannel[];
  presets: RangePreset[];
}) {
  const options = channels.map((channel) => ({ value: channel.channel, label: channel.channelName ?? channel.channel }));
  if (query.channel && !options.some((option) => option.value === query.channel)) {
    options.push({ value: query.channel, label: query.channel });
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <form
        method="get"
        action="/analytics"
        aria-label="Filtros de analítica"
        className="flex flex-wrap items-end gap-3"
      >
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Desde</span>
          <input type="date" name="from" defaultValue={query.from} max={query.to} required className={fieldClass} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Hasta</span>
          <input type="date" name="to" defaultValue={query.to} min={query.from} required className={fieldClass} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Canal</span>
          <select name="channel" defaultValue={query.channel ?? ""} className={fieldClass}>
            <option value="">Todos los canales</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonVariants({ variant: "default" })}>
          Aplicar
        </button>
      </form>

      <nav aria-label="Rangos rápidos" className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Link
            key={preset.days}
            href={preset.href}
            aria-current={preset.active ? "true" : undefined}
            className={cn(buttonVariants({ variant: preset.active ? "secondary" : "outline" }))}
          >
            Últimos {preset.days} días
          </Link>
        ))}
      </nav>
    </div>
  );
}
