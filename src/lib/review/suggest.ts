import { MAX_INTENT_NAME_LENGTH } from "@/lib/intents/schema";
import type { UnmatchedCluster } from "@/lib/gateway/schemas";

export interface IntentSuggestion {
  name: string;
  keywords: string[];
  description: string;
}

const MAX_NAME_WORDS = 2;
const MAX_KEYWORDS = 3;
const MAX_KEYWORD_LENGTH = 60;
const MIN_WORD_LENGTH = 3;

/** Words that carry no topic. Messages may be in any language; this only trims the common English filler. */
const STOPWORDS = new Set([
  "the", "and", "for", "you", "your", "with", "this", "that", "are", "was", "have", "has", "can", "could",
  "would", "should", "how", "what", "when", "where", "why", "who", "not", "but", "please", "from", "about",
  "into", "just", "need", "like", "get", "got", "does", "did", "its", "our", "out", "any", "want", "wants",
  "wanted", "know", "tell", "try", "make",
]);

/** Strips PII placeholders such as [EMAIL] and collapses whitespace. */
function clean(text: string): string {
  return text.replace(/\[[A-Z_]+\]/g, " ").replace(/\s+/g, " ").trim();
}

function words(text: string): string[] {
  const plain = clean(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return (plain.match(/[a-z0-9]+/g) ?? []).filter((word) => word.length >= MIN_WORD_LENGTH && !STOPWORDS.has(word));
}

/**
 * Pre-fills the "new intent" dialog from a cluster: a name from the most frequent meaningful words
 * (weighted by how often each message was seen), the most frequent distinct message texts as keywords,
 * and a description saying where the intent came from. Everything stays editable.
 */
export function suggestIntentFromCluster(cluster: UnmatchedCluster): IntentSuggestion {
  const weight = new Map<string, number>();
  for (const member of cluster.members) {
    for (const word of new Set(words(member.maskedText))) {
      weight.set(word, (weight.get(word) ?? 0) + member.occurrences);
    }
  }
  // Map keeps insertion order, and Array.sort is stable: ties resolve by first appearance.
  const top = [...weight.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_NAME_WORDS).map(([word]) => word);
  const name = top.length > 0 ? top.join("_").slice(0, MAX_INTENT_NAME_LENGTH) : "nueva_intencion";

  const seen = new Set<string>();
  const keywords: string[] = [];
  const byFrequency = [...cluster.members].sort((a, b) => b.occurrences - a.occurrences);
  for (const member of byFrequency) {
    const keyword = clean(member.maskedText).toLowerCase().slice(0, MAX_KEYWORD_LENGTH).trim();
    if (!keyword || words(keyword).length === 0 || seen.has(keyword)) continue;
    seen.add(keyword);
    keywords.push(keyword);
    if (keywords.length === MAX_KEYWORDS) break;
  }

  const count = cluster.members.length;
  const example = clean(cluster.representativeText);
  const description = `Creada a partir de ${count} ${count === 1 ? "mensaje similar no reconocido" : "mensajes similares no reconocidos"}${
    example ? `, por ejemplo: "${example}"` : ""
  }.`;
  return { name, keywords, description };
}
