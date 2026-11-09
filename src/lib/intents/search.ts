import type { Intent } from "@/lib/gateway/schemas";

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Client-side search by intent name, keyword, tag or description (accent/case
 * insensitive), optionally narrowed to intents carrying an exact tag.
 */
export function filterIntents(intents: Intent[], query: string, tag = ""): Intent[] {
  const needle = fold(query.trim());
  const wantedTag = fold(tag.trim());
  return intents.filter((item) => {
    if (wantedTag && !item.tags.some((candidate) => fold(candidate) === wantedTag)) return false;
    if (!needle) return true;
    return [item.intent, item.description ?? "", ...item.keywords, ...item.tags].some((text) =>
      fold(text).includes(needle),
    );
  });
}

/** Distinct tags across the catalog (case-insensitive, first spelling wins), sorted for display. */
export function collectTags(intents: Intent[]): string[] {
  const byKey = new Map<string, string>();
  for (const item of intents) {
    for (const tag of item.tags) {
      const key = fold(tag);
      if (!byKey.has(key)) byKey.set(key, tag);
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}
