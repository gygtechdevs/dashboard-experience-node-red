/** Fixed UTC format so server and client render the same text. */
export function formatDate(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso) ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : iso;
}

/** 0.912 -> "91%". */
export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** Spanish status words (plural, lowercase) for sentences such as "No hay mensajes pendientes". */
export const STATUS_PLURAL = { pending: "pendientes", approved: "aprobados", rejected: "rechazados" } as const;

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
