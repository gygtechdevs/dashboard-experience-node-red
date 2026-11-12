import type { z } from "zod";
import type { AnalyticsQuery } from "@/lib/analytics/query";
import type { FieldErrors } from "@/lib/intents/schema";
import {
  analyticsByChannelResponseSchema,
  analyticsDailyResponseSchema,
  analyticsSummaryResponseSchema,
  analyticsTopTagsResponseSchema,
  approveUnmatchedResponseSchema,
  bulkReviewResponseSchema,
  errorResponseSchema,
  impactSimulationResponseSchema,
  intentsResponseSchema,
  okResponseSchema,
  rejectUnmatchedResponseSchema,
  unmatchedClustersResponseSchema,
  unmatchedPageResponseSchema,
  type AnalyticsChannel,
  type AnalyticsDay,
  type AnalyticsSummary,
  type AnalyticsTag,
  type ApproveUnmatchedResult,
  type BulkReviewResult,
  type CreateIntentPayload,
  type ImpactSimulation,
  type Intent,
  type UnmatchedClusters,
  type UnmatchedPage,
  type UnmatchedStatus,
  type UpdateIntentPayload,
} from "./schemas";

export type GatewayErrorKind =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "unavailable"
  | "unexpected_response";

export class GatewayError extends Error {
  constructor(
    readonly kind: GatewayErrorKind,
    readonly status: number,
    message: string,
    readonly fieldErrors: FieldErrors = {},
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

/** Best-effort mapping of a gateway/intents-service message to a form field. */
export function inferFieldErrors(message: string): FieldErrors {
  if (/initialStep/i.test(message)) return { initialStep: message };
  if (/\btags?\b/i.test(message)) return { tags: message };
  if (/keywords?/i.test(message)) return { keywords: message };
  if (/description/i.test(message)) return { description: message };
  if (/\b(intent|name)\b/i.test(message)) return { intent: message };
  return {};
}

export function kindForStatus(status: number): GatewayErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "validation";
  return "unavailable";
}

/** The single place where HTTP statuses become typed errors. */
async function toGatewayError(response: Response): Promise<GatewayError> {
  const kind = kindForStatus(response.status);
  let message = `El gateway respondió con el estado ${response.status}`;
  try {
    const parsed = errorResponseSchema.safeParse(await response.json());
    if (parsed.success) message = parsed.data.error;
  } catch {
    // Non-JSON body: keep the generic message.
  }
  const fieldErrors = kind === "validation" || kind === "conflict" ? inferFieldErrors(message) : {};
  if (kind === "conflict" && Object.keys(fieldErrors).length === 0) fieldErrors.intent = message;
  return new GatewayError(kind, response.status, message, fieldErrors);
}

export interface GatewayClientOptions {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface GatewayClient {
  listIntents(): Promise<Intent[]>;
  createIntent(payload: CreateIntentPayload): Promise<void>;
  updateIntent(name: string, payload: UpdateIntentPayload): Promise<void>;
  deleteIntent(name: string): Promise<void>;
  getAnalyticsSummary(query: AnalyticsQuery): Promise<AnalyticsSummary>;
  /** Always compares every channel: the channel filter is ignored. */
  getAnalyticsByChannel(query: AnalyticsQuery): Promise<AnalyticsChannel[]>;
  getAnalyticsTopTags(query: AnalyticsQuery): Promise<AnalyticsTag[]>;
  getAnalyticsDaily(query: AnalyticsQuery): Promise<AnalyticsDay[]>;
  /** Review queue. 404 means unmatched capture is disabled; ADMIN permission is enforced upstream. */
  listUnmatched(query: UnmatchedListQuery): Promise<UnmatchedPage>;
  approveUnmatched(id: string, intent: string): Promise<ApproveUnmatchedResult>;
  rejectUnmatched(id: string): Promise<void>;
  /** Pending messages grouped by similarity. Slow (embeds upstream), hence the longer timeout. */
  listUnmatchedClusters(): Promise<UnmatchedClusters>;
  /** Dry-run estimate: nothing is written. */
  simulateClusterImpact(input: { intent: string; ids: string[]; days?: number }): Promise<ImpactSimulation>;
  /** Per-item results: a partial failure is a normal outcome, not an exception. */
  bulkApproveUnmatched(input: { intent: string; ids: string[] }): Promise<BulkReviewResult>;
  bulkRejectUnmatched(input: { ids: string[] }): Promise<BulkReviewResult>;
}

/** Cluster, simulation and bulk calls embed and loop over many messages upstream. */
const SLOW_TIMEOUT_MS = 35_000;

export interface UnmatchedListQuery {
  status?: UnmatchedStatus;
  limit?: number;
  cursor?: string;
}

function unmatchedListPath(query: UnmatchedListQuery): string {
  const search = new URLSearchParams();
  if (query.status) search.set("status", query.status);
  if (query.limit !== undefined) search.set("limit", String(query.limit));
  if (query.cursor) search.set("cursor", query.cursor);
  const qs = search.toString();
  return `/api/admin/unmatched${qs ? `?${qs}` : ""}`;
}

function analyticsPath(resource: string, query: AnalyticsQuery, extra: Record<string, string> = {}): string {
  const search = new URLSearchParams({ from: query.from, to: query.to });
  if (query.channel) search.set("channel", query.channel);
  for (const [key, value] of Object.entries(extra)) search.set(key, value);
  return `/api/admin/analytics/${resource}?${search.toString()}`;
}

export function createGatewayClient({
  baseUrl,
  token,
  fetchImpl = fetch,
  timeoutMs = 10_000,
}: GatewayClientOptions): GatewayClient {
  const root = baseUrl.replace(/\/+$/, "");

  async function request<S extends z.ZodType>(
    path: string,
    schema: S,
    init: { method?: string; body?: unknown; timeoutMs?: number } = {},
  ): Promise<z.output<S>> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`,
      accept: "application/json",
    };
    if (init.body !== undefined) headers["content-type"] = "application/json";

    let response: Response;
    try {
      response = await fetchImpl(`${root}${path}`, {
        method: init.method ?? "GET",
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        cache: "no-store",
        signal: AbortSignal.timeout(init.timeoutMs ?? timeoutMs),
      });
    } catch {
      throw new GatewayError("unavailable", 0, "No se pudo contactar con el gateway");
    }

    if (!response.ok) throw await toGatewayError(response);

    try {
      return schema.parse(await response.json());
    } catch {
      throw new GatewayError("unexpected_response", response.status, "El gateway devolvió una respuesta inesperada");
    }
  }

  const intentPath = (name: string) => `/api/admin/intents/${encodeURIComponent(name)}`;

  return {
    listIntents: async () => (await request("/api/admin/intents", intentsResponseSchema)).intents,
    createIntent: async (payload) => {
      await request("/api/admin/intents", okResponseSchema, { method: "POST", body: payload });
    },
    updateIntent: async (name, payload) => {
      await request(intentPath(name), okResponseSchema, { method: "PUT", body: payload });
    },
    deleteIntent: async (name) => {
      await request(intentPath(name), okResponseSchema, { method: "DELETE" });
    },
    getAnalyticsSummary: async (query) =>
      (await request(analyticsPath("summary", query), analyticsSummaryResponseSchema)).data,
    getAnalyticsByChannel: async (query) =>
      (await request(analyticsPath("by-channel", { ...query, channel: undefined }), analyticsByChannelResponseSchema)).data,
    getAnalyticsTopTags: async (query) =>
      (await request(analyticsPath("top-tags", query, { limit: "3" }), analyticsTopTagsResponseSchema)).data,
    getAnalyticsDaily: async (query) =>
      (await request(analyticsPath("daily", query), analyticsDailyResponseSchema)).data,
    listUnmatched: async (query) => (await request(unmatchedListPath(query), unmatchedPageResponseSchema)).data,
    approveUnmatched: async (id, intent) =>
      (
        await request(`/api/admin/unmatched/${encodeURIComponent(id)}/approve`, approveUnmatchedResponseSchema, {
          method: "POST",
          body: { intent },
        })
      ).data,
    rejectUnmatched: async (id) => {
      await request(`/api/admin/unmatched/${encodeURIComponent(id)}/reject`, rejectUnmatchedResponseSchema, {
        method: "POST",
      });
    },
    listUnmatchedClusters: async () =>
      (await request("/api/admin/unmatched/clusters", unmatchedClustersResponseSchema, { timeoutMs: SLOW_TIMEOUT_MS })).data,
    simulateClusterImpact: async (input) =>
      (
        await request("/api/admin/unmatched/clusters/simulate", impactSimulationResponseSchema, {
          method: "POST",
          body: input,
          timeoutMs: SLOW_TIMEOUT_MS,
        })
      ).data,
    bulkApproveUnmatched: async (input) =>
      (
        await request("/api/admin/unmatched/bulk/approve", bulkReviewResponseSchema, {
          method: "POST",
          body: input,
          timeoutMs: SLOW_TIMEOUT_MS,
        })
      ).data,
    bulkRejectUnmatched: async (input) =>
      (
        await request("/api/admin/unmatched/bulk/reject", bulkReviewResponseSchema, {
          method: "POST",
          body: input,
          timeoutMs: SLOW_TIMEOUT_MS,
        })
      ).data,
  };
}
