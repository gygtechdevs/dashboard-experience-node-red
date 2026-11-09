/** Pure helpers for the Analytics filters, which live in the URL search params. */

export interface AnalyticsQuery {
  /** First UTC day, YYYY-MM-DD (inclusive). */
  from: string;
  /** Last UTC day, YYYY-MM-DD (inclusive). */
  to: string;
  channel?: string | undefined;
}

export type SearchParamsInput = Record<string, string | string[] | undefined>;

export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 366;
export const PRESET_DAYS = [7, 30, 90] as const;

const DAY_MS = 86_400_000;
const CHANNEL_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const toDay = (date: Date): string => date.toISOString().slice(0, 10);

function parseDay(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || toDay(date) !== value ? null : date;
}

const startOfUtcDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

/** Last `days` UTC days ending on `today` (inclusive). */
export function presetRange(days: number, today: Date): { from: string; to: string } {
  const end = startOfUtcDay(today);
  return { from: toDay(new Date(end.getTime() - (days - 1) * DAY_MS)), to: toDay(end) };
}

/**
 * Normalises untrusted search params. Anything invalid falls back to the default range (last 30
 * days) so a hand-edited URL never produces a failing request.
 */
export function parseAnalyticsParams(params: SearchParamsInput, today: Date): AnalyticsQuery {
  const channelRaw = first(params.channel);
  const channel = channelRaw && CHANNEL_PATTERN.test(channelRaw) ? channelRaw : undefined;

  const rawFrom = first(params.from);
  const rawTo = first(params.to);
  const fromDate = parseDay(rawFrom);
  const toDate = parseDay(rawTo);
  const fallback = presetRange(DEFAULT_RANGE_DAYS, today);

  // A provided-but-invalid value invalidates the range; a missing one is derived from the other.
  if ((rawFrom && !fromDate) || (rawTo && !toDate)) return { ...fallback, channel };

  const end = toDate ?? startOfUtcDay(today);
  const start = fromDate ?? new Date(end.getTime() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS);
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  if (start > end || days > MAX_RANGE_DAYS) return { ...fallback, channel };

  return { from: toDay(start), to: toDay(end), channel };
}

export function buildAnalyticsHref(query: AnalyticsQuery): string {
  const search = new URLSearchParams({ from: query.from, to: query.to });
  if (query.channel) search.set("channel", query.channel);
  return `/analytics?${search.toString()}`;
}
