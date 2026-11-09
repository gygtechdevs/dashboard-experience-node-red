import Link from "next/link";
import { CAPTURE_DISABLED_HELP, CAPTURE_DISABLED_TITLE, ADMIN_REQUIRED_MESSAGE } from "@/lib/review/messages";

export function ReviewGuidance() {
  return (
    <section aria-labelledby="review-guidance" className="rounded-lg border bg-muted/30 p-4 text-sm">
      <h2 id="review-guidance" className="font-medium">
        Cómo revisar
      </h2>
      <ul className="mt-2 grid list-disc gap-1 pl-5 text-muted-foreground">
        <li>
          <strong className="text-foreground">Aprobar</strong> un mensaje cuando es una consulta real de un usuario que corresponde a una
          intención existente: se elige la intención y el texto pasa a ser un nuevo ejemplo que ayuda al bot a
          reconocerla la próxima vez.
        </li>
        <li>
          <strong className="text-foreground">Los grupos</strong> reúnen mensajes similares para revisarlos en conjunto:
          primero se simula el impacto sobre los mensajes recientes y luego se aprueba o rechaza el grupo completo.
        </li>
        <li>
          Si ninguna intención corresponde, cree una nueva en{" "}
          <Link href="/knowledge/custom" className="underline underline-offset-2">
            Conocimiento
          </Link>{" "}
          primero y luego vuelva para aprobar el mensaje en ella.
        </li>
        <li>
          <strong className="text-foreground">Rechazar</strong> el ruido: saludos, spam, texto sin sentido o restos con
          datos personales.
        </li>
        <li>Los textos se muestran con los datos personales enmascarados. Los elementos revisados y los obsoletos se eliminan automáticamente al terminar el período de retención.</li>
      </ul>
    </section>
  );
}

type NoticeProps =
  | { kind: "disabled" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string };

export function ReviewNotice(props: NoticeProps) {
  if (props.kind === "disabled") {
    return (
      <div role="status" className="rounded-lg border bg-muted/30 p-6">
        <h2 className="font-medium">{CAPTURE_DISABLED_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{CAPTURE_DISABLED_HELP}</p>
      </div>
    );
  }
  const message = props.kind === "forbidden" ? ADMIN_REQUIRED_MESSAGE : props.message;
  return (
    <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
      <h2 className="font-medium">{props.kind === "forbidden" ? "Acceso restringido" : "No se pudo cargar la cola de revisión"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
