import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { IntentsSkeleton } from "@/components/intents-skeleton";
import { IntentsTable } from "@/components/intents-table";
import { canDeleteIntents, canWriteIntents } from "@/lib/auth/jwt";
import { getSession } from "@/lib/auth/session";
import { GatewayError } from "@/lib/gateway/client";
import { describeGatewayError, withGateway } from "@/lib/gateway/server";
import type { Step } from "@/lib/gateway/schemas";

export const metadata: Metadata = { title: "Conocimiento personalizado | Node-RED Dashboard" };

export default function CustomKnowledgePage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Conocimiento</h1>
        <p className="text-sm text-muted-foreground">
          Intenciones personalizadas: asocian lo que dicen los usuarios con el paso de Node-RED que lo atiende.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          ¿Mensajes que el bot no entendió?{" "}
          <Link href="/training/review" className="underline underline-offset-2">
            Abrir la cola de revisión
          </Link>
          .
        </p>
      </header>
      {/* Request-time data (cookie + gateway) streams in behind a Suspense boundary. */}
      <Suspense fallback={<IntentsSkeleton />}>
        <IntentsSection />
      </Suspense>
    </div>
  );
}

async function IntentsSection() {
  const session = await getSession();

  const [intentsResult, stepsResult] = await Promise.allSettled([
    withGateway((client) => client.listIntents()),
    withGateway((client) => client.listSteps()),
  ]);

  // withGateway redirects on 401 by throwing NEXT_REDIRECT; let it propagate.
  for (const result of [intentsResult, stepsResult]) {
    if (result.status === "rejected" && !(result.reason instanceof GatewayError)) throw result.reason;
  }

  const steps: Step[] | null = stepsResult.status === "fulfilled" ? stepsResult.value : null;

  if (intentsResult.status === "rejected") {
    return (
      <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
        <h2 className="font-medium">No se pudieron cargar las intenciones</h2>
        <p className="mt-1 text-sm text-muted-foreground">{describeGatewayError(intentsResult.reason)}</p>
      </div>
    );
  }

  return (
    <IntentsTable
      intents={intentsResult.value}
      steps={steps}
      canWrite={canWriteIntents(session)}
      canDelete={canDeleteIntents(session)}
    />
  );
}
