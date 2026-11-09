import type { AnalyticsChannel, AnalyticsDay } from "@/lib/gateway/schemas";

export interface ChannelMeta {
  key: string;
  label: string;
  /** Theme token, e.g. `var(--chart-1)`. */
  color: string;
}

const PALETTE_SIZE = 5;

/**
 * One stable key/label/colour per channel, shared by every chart so a channel always has the same
 * colour. Order is alphabetical by key, independent of the data volume.
 */
export function channelMeta(channels: AnalyticsChannel[], daily: AnalyticsDay[]): ChannelMeta[] {
  const labels = new Map<string, string>();
  for (const channel of channels) labels.set(channel.channel, channel.channelName ?? channel.channel);
  for (const day of daily) for (const key of Object.keys(day.byChannel)) if (!labels.has(key)) labels.set(key, key);

  return [...labels.keys()]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((key, index) => ({
      key,
      label: labels.get(key) as string,
      color: `var(--chart-${(index % PALETTE_SIZE) + 1})`,
    }));
}
