import type { ImpactSimulation } from "@/lib/gateway/schemas";
import { formatPercent, plural } from "@/lib/review/format";

const SOURCE_LABEL: Record<ImpactSimulation["regressions"]["samples"][number]["source"], string> = {
  unmatched: "mensaje pendiente",
  keyword: "ejemplo almacenado (palabra clave)",
  description: "ejemplo almacenado (descripción)",
  approved: "ejemplo almacenado (aprobado)",
};

/** Result of a dry run. Always framed as an estimate; the scope line says exactly what was checked. */
export function ImpactPanel({ impact }: { impact: ImpactSimulation }) {
  const { newlyMatched, regressions, scope } = impact;
  return (
    <section aria-label="Impacto estimado" className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-medium">Impacto estimado</h4>
        <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">Estimación, no exacta</span>
      </div>

      <div className="grid gap-1">
        <p>{`${plural(newlyMatched.count, "mensaje no reconocido", "mensajes no reconocidos")} ${newlyMatched.count === 1 ? "coincidiría" : "coincidirían"} ahora con "${impact.intent}".`}</p>
        <p className="text-xs text-muted-foreground">
          {`${newlyMatched.selected} de esta selección y ${newlyMatched.others} de otros mensajes pendientes; vistos ${plural(newlyMatched.occurrences, "vez", "veces")} en total.`}
        </p>
        {newlyMatched.samples.length > 0 ? (
          <ul className="mt-1 grid gap-1">
            {newlyMatched.samples.map((sample) => (
              <li key={sample.id} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <span className="break-words">{sample.maskedText}</span>
                <span className="text-muted-foreground">{formatPercent(sample.similarity)} de similitud</span>
              </li>
            ))}
            {newlyMatched.count > newlyMatched.samples.length ? (
              <li className="text-xs text-muted-foreground">{`y ${newlyMatched.count - newlyMatched.samples.length} más`}</li>
            ) : null}
          </ul>
        ) : null}
        {impact.ambiguous > 0 ? (
          <p className="text-xs text-muted-foreground">
            {`${impact.ambiguous} ${impact.ambiguous === 1 ? "mensaje más sería ambiguo y queda" : "mensajes más serían ambiguos y quedan"} a cargo del desempate por IA en tiempo de ejecución; no se cuentan como coincidencias.`}
          </p>
        ) : null}
      </div>

      <div className="grid gap-1">
        {regressions.count > 0 ? (
          <>
            <p className="font-medium text-destructive">
              {`${plural(regressions.count, "posible regresión", "posibles regresiones")}: textos que hoy se resuelven a otra intención pero pasarían a "${impact.intent}".`}
            </p>
            <ul className="grid gap-1">
              {regressions.samples.map((sample, index) => (
                <li key={`${sample.maskedText}:${index}`} className="grid text-xs">
                  <span className="break-words">{sample.maskedText}</span>
                  <span className="text-muted-foreground">
                    {`${sample.from} → ${impact.intent} · ${formatPercent(sample.similarity)} de similitud · ${SOURCE_LABEL[sample.source]}`}
                  </span>
                </li>
              ))}
              {regressions.count > regressions.samples.length ? (
                <li className="text-xs text-muted-foreground">{`y ${regressions.count - regressions.samples.length} más`}</li>
              ) : null}
            </ul>
          </>
        ) : (
          <p>No se encontraron regresiones en los datos revisados.</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {`Basado en ${plural(scope.replayedMessages, "mensaje pendiente", "mensajes pendientes")} de los últimos ${impact.days} días y ${plural(scope.examplesChecked, "ejemplo almacenado", "ejemplos almacenados")} de otras intenciones. Las coincidencias por palabra clave y el desempate por IA no se simulan, por lo que los resultados reales pueden diferir.`}
        {scope.replayTruncated || scope.examplesTruncated
          ? " Solo se revisaron los mensajes más frecuentes y los ejemplos más recientes."
          : ""}
      </p>
    </section>
  );
}
