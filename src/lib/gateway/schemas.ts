import { z } from "zod";

export const intentSchema = z.object({
  intent: z.string(),
  initialStep: z.string(),
  keywords: z.array(z.string()),
  /** Older gateways do not send tags. */
  tags: z.array(z.string()).default([]),
  description: z.string().optional(),
});
export type Intent = z.infer<typeof intentSchema>;

export const stepSchema = z.object({ name: z.string(), path: z.string() });
export type Step = z.infer<typeof stepSchema>;

export const intentsResponseSchema = z.object({ ok: z.literal(true), intents: z.array(intentSchema) });
export const okResponseSchema = z.object({ ok: z.literal(true) }).loose();
export const errorResponseSchema = z.object({ error: z.string() }).loose();

export interface CreateIntentPayload {
  intent: string;
  initialStep: string;
  keywords: string[];
  tags?: string[];
  description?: string;
}

export interface UpdateIntentPayload {
  initialStep: string;
  keywords?: string[];
  tags?: string[];
  description?: string;
}

// ── Analytics (proxied by the gateway as `{ ok: true, data }`) ───────────────────

export const analyticsSummarySchema = z.object({
  totalMessages: z.number(),
  uniqueConversations: z.number(),
  /** Fractions between 0 and 1. */
  matchedRate: z.number(),
  errorRate: z.number(),
  previousPeriod: z.object({
    totalMessages: z.number(),
    /** Null when the previous period had no messages. */
    deltaPct: z.number().nullable(),
  }),
});
export type AnalyticsSummary = z.infer<typeof analyticsSummarySchema>;

export const analyticsByChannelSchema = z.array(
  z.object({
    channel: z.string(),
    channelName: z.string().nullable(),
    messages: z.number(),
    conversations: z.number(),
  }),
);
export type AnalyticsChannel = z.infer<typeof analyticsByChannelSchema>[number];

export const analyticsTopTagsSchema = z.array(z.object({ tag: z.string(), count: z.number(), pct: z.number() }));
export type AnalyticsTag = z.infer<typeof analyticsTopTagsSchema>[number];

export const analyticsDailySchema = z.array(
  z.object({ date: z.string(), byChannel: z.record(z.string(), z.number()), total: z.number() }),
);
export type AnalyticsDay = z.infer<typeof analyticsDailySchema>[number];

const analyticsEnvelope = <S extends z.ZodType>(data: S) => z.object({ ok: z.literal(true), data });
export const analyticsSummaryResponseSchema = analyticsEnvelope(analyticsSummarySchema);
export const analyticsByChannelResponseSchema = analyticsEnvelope(analyticsByChannelSchema);
export const analyticsTopTagsResponseSchema = analyticsEnvelope(analyticsTopTagsSchema);
export const analyticsDailyResponseSchema = analyticsEnvelope(analyticsDailySchema);

// ── Review queue (unmatched messages, proxied as `{ ok: true, data }`) ───────────

export const UNMATCHED_STATUSES = ["pending", "approved", "rejected"] as const;
export type UnmatchedStatus = (typeof UNMATCHED_STATUSES)[number];

export const unmatchedItemSchema = z.object({
  id: z.string(),
  /** PII-masked by the backend: the raw text never leaves intents-service. */
  maskedText: z.string(),
  occurrences: z.number(),
  status: z.enum(UNMATCHED_STATUSES),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  resolvedIntent: z.string().nullish(),
  resolvedBy: z.string().nullish(),
  resolvedAt: z.string().nullish(),
});
export type UnmatchedItem = z.infer<typeof unmatchedItemSchema>;

export const unmatchedPageSchema = z.object({
  items: z.array(unmatchedItemSchema),
  nextCursor: z.string().nullish().transform((cursor) => cursor ?? null),
});
export type UnmatchedPage = z.infer<typeof unmatchedPageSchema>;

export const approveUnmatchedResultSchema = z.object({
  id: z.string(),
  status: z.literal("approved"),
  intent: z.string(),
  /** False when the example was stored but could not be embedded (needs a re-embed). */
  embedded: z.boolean(),
});
export type ApproveUnmatchedResult = z.infer<typeof approveUnmatchedResultSchema>;

export const rejectUnmatchedResultSchema = z.object({ id: z.string(), status: z.literal("rejected") });

// ── Clusters, impact simulation and bulk review ──────────────────────────────────

export const CLUSTER_METHODS = ["semantic", "lexical"] as const;
export type ClusterMethod = (typeof CLUSTER_METHODS)[number];

export const clusterMemberSchema = z.object({
  id: z.string(),
  maskedText: z.string(),
  occurrences: z.number(),
});
export type ClusterMember = z.infer<typeof clusterMemberSchema>;

export const unmatchedClusterSchema = z.object({
  id: z.string(),
  representativeText: z.string(),
  /** Sum of the members' occurrences. */
  size: z.number(),
  memberIds: z.array(z.string()),
  members: z.array(clusterMemberSchema),
  /** Closest existing intent; null when none is comparable. */
  nearestIntent: z.object({ intent: z.string(), similarity: z.number() }).nullable(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
});
export type UnmatchedCluster = z.infer<typeof unmatchedClusterSchema>;

export const unmatchedClustersSchema = z.object({
  /** `semantic`: embedding similarity. `lexical`: token-set fallback (embeddings unavailable). */
  method: z.enum(CLUSTER_METHODS),
  analyzed: z.number(),
  /** True when more pending messages exist than were grouped. */
  truncated: z.boolean(),
  clusters: z.array(unmatchedClusterSchema),
});
export type UnmatchedClusters = z.infer<typeof unmatchedClustersSchema>;

export const impactSimulationSchema = z.object({
  intent: z.string(),
  days: z.number(),
  selected: z.number(),
  scope: z.object({
    /** Always false: the simulation is an estimate, never an exact replay. */
    exact: z.literal(false),
    basis: z.string(),
    replayedMessages: z.number(),
    replayTruncated: z.boolean(),
    examplesChecked: z.number(),
    examplesTruncated: z.boolean(),
    minSimilarity: z.number(),
    ambiguityMargin: z.number(),
  }),
  newlyMatched: z.object({
    count: z.number(),
    selected: z.number(),
    others: z.number(),
    occurrences: z.number(),
    samples: z.array(
      z.object({
        id: z.string(),
        maskedText: z.string(),
        similarity: z.number(),
        occurrences: z.number(),
        selected: z.boolean(),
      }),
    ),
  }),
  ambiguous: z.number(),
  regressions: z.object({
    count: z.number(),
    samples: z.array(
      z.object({
        maskedText: z.string(),
        from: z.string(),
        similarity: z.number(),
        source: z.enum(["unmatched", "keyword", "description", "approved"]),
      }),
    ),
  }),
});
export type ImpactSimulation = z.infer<typeof impactSimulationSchema>;

export const bulkReviewResultSchema = z.object({
  intent: z.string().optional(),
  succeeded: z.number(),
  failed: z.number(),
  results: z.array(
    z.discriminatedUnion("ok", [
      z.object({ id: z.string(), ok: z.literal(true), embedded: z.boolean().optional() }),
      z.object({ id: z.string(), ok: z.literal(false), status: z.number(), error: z.string() }),
    ]),
  ),
});
export type BulkReviewResult = z.infer<typeof bulkReviewResultSchema>;

export const unmatchedClustersResponseSchema = analyticsEnvelope(unmatchedClustersSchema);
export const impactSimulationResponseSchema = analyticsEnvelope(impactSimulationSchema);
export const bulkReviewResponseSchema = analyticsEnvelope(bulkReviewResultSchema);

export const unmatchedPageResponseSchema = analyticsEnvelope(unmatchedPageSchema);
export const approveUnmatchedResponseSchema = analyticsEnvelope(approveUnmatchedResultSchema);
export const rejectUnmatchedResponseSchema = analyticsEnvelope(rejectUnmatchedResultSchema);
