const numberFormat = new Intl.NumberFormat("es");

export const formatCount = (value: number): string => numberFormat.format(value);

/** `fraction` is 0-1. */
const percentFormat = new Intl.NumberFormat("es", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const formatRate = (fraction: number): string => `${percentFormat.format(fraction * 100)}%`;

/** `pct` is already 0-100. */
export const formatPct = (pct: number): string => `${percentFormat.format(pct)}%`;

/** "2026-05-10" -> "10 may" (always in UTC, matching how the days are bucketed). */
export function formatDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("es", { month: "short", day: "numeric", timeZone: "UTC" });
}
