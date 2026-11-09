import type { BulkReviewResult, UnmatchedCluster } from "@/lib/gateway/schemas";

/**
 * Ids that are no longer pending after a bulk call: the ones that succeeded, plus the ones that failed
 * because they are gone (404) or were already reviewed by someone else (409). Other failures stay.
 */
export function resolvedIds(result: BulkReviewResult): Set<string> {
  const gone = new Set<string>();
  for (const item of result.results) {
    if (item.ok || item.status === 404 || item.status === 409) gone.add(item.id);
  }
  return gone;
}

/** The cluster without `removed` members, or null when nothing is left. Size and representative are recomputed. */
export function withoutMembers(cluster: UnmatchedCluster, removed: ReadonlySet<string>): UnmatchedCluster | null {
  const members = cluster.members.filter((member) => !removed.has(member.id));
  if (members.length === 0) return null;
  if (members.length === cluster.members.length) return cluster;
  const leader = members.reduce((best, member) => (member.occurrences > best.occurrences ? member : best));
  return {
    ...cluster,
    members,
    memberIds: members.map((member) => member.id),
    size: members.reduce((sum, member) => sum + member.occurrences, 0),
    representativeText: leader.maskedText,
  };
}
