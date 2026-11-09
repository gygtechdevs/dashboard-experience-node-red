import { Suspense } from "react";
import type { Metadata } from "next";
import { ReviewGuidance, ReviewNotice } from "@/components/review/review-guidance";
import { ReviewClusters } from "@/components/review/review-clusters";
import { ReviewQueue } from "@/components/review/review-queue";
import { ReviewSkeleton } from "@/components/review/review-skeleton";
import { canReviewUnmatched } from "@/lib/auth/jwt";
import { getSession } from "@/lib/auth/session";
import { GatewayError } from "@/lib/gateway/client";
import { UNMATCHED_STATUSES, type UnmatchedStatus } from "@/lib/gateway/schemas";
import { withGateway } from "@/lib/gateway/server";
import { describeReviewError, isCaptureDisabled, type ReviewOperation } from "@/lib/review/messages";

export const metadata: Metadata = { title: "Cola de revisión | Node-RED Dashboard" };

const PAGE_SIZE = 50;

type SearchParamsInput = Record<string, string | string[] | undefined>;

/** `?status=` selects a message list; without a valid status the default view is the clusters. */
function parseStatus(raw: string | string[] | undefined): UnmatchedStatus | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return UNMATCHED_STATUSES.find((status) => status === value) ?? null;
}

export default function ReviewPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Cola de revisión</h1>
        <p className="text-sm text-muted-foreground">
          Mensajes que el bot no entendió. Pueden revisarse como grupos de mensajes similares o uno por uno, y se
          entrena al bot aprobándolos como ejemplos de una intención.
        </p>
      </header>
      <ReviewGuidance />
      {/* Request-time data (search params, cookie, gateway) streams in behind a Suspense boundary. */}
      <Suspense fallback={<ReviewSkeleton />}>
        <ReviewSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function noticeFor(error: unknown, operation: ReviewOperation) {
  // withGateway redirects on 401 by throwing NEXT_REDIRECT; let anything else that is not a gateway error propagate.
  if (!(error instanceof GatewayError)) throw error;
  if (isCaptureDisabled(error)) return <ReviewNotice kind="disabled" />;
  if (error.kind === "forbidden") return <ReviewNotice kind="forbidden" />;
  return <ReviewNotice kind="error" message={describeReviewError(error, operation)} />;
}

async function ReviewSection({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const status = parseStatus((await searchParams).status);
  const session = await getSession();
  if (!canReviewUnmatched(session)) return <ReviewNotice kind="forbidden" />;
  return status === null ? <ClustersSection /> : <ListSection status={status} />;
}

async function ClustersSection() {
  let data;
  try {
    data = await withGateway(async (client) => {
      // The clusters call decides if the feature is on: a 404 here must not be masked by the other calls.
      const clusters = await client.listUnmatchedClusters();
      const intents = await client.listIntents();
      // The steps catalog only feeds the "new intent" dialog: its failure must not hide the clusters.
      const steps = await client.listSteps().catch(() => null);
      return { clusters, intents, steps };
    });
  } catch (error) {
    return noticeFor(error, "clusters");
  }

  const { clusters, intents, steps } = data;
  return (
    <ReviewClusters
      // Remount when the server data changes so local state restarts from it.
      key={clusters.clusters.map((cluster) => cluster.id).join(",")}
      data={clusters}
      intents={intents.map((intent) => intent.intent)}
      steps={steps}
      tagSuggestions={[...new Set(intents.flatMap((intent) => intent.tags))].sort()}
    />
  );
}

async function ListSection({ status }: { status: UnmatchedStatus }) {
  let data;
  try {
    data = await withGateway(async (client) => {
      // The page decides if the feature is on: a 404 here must not be masked by the intents call.
      const page = await client.listUnmatched({ status, limit: PAGE_SIZE });
      const intents = status === "pending" ? await client.listIntents() : [];
      return { page, intents };
    });
  } catch (error) {
    return noticeFor(error, "list");
  }

  const { page, intents } = data;
  return (
    <ReviewQueue
      // Remount when the tab or the server data changes so local state restarts from it.
      key={`${status}:${page.items.map((item) => item.id).join(",")}`}
      items={page.items}
      nextCursor={page.nextCursor}
      status={status}
      intents={intents.map((intent) => intent.intent)}
    />
  );
}
