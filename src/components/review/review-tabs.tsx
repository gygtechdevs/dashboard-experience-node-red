import Link from "next/link";
import type { UnmatchedStatus } from "@/lib/gateway/schemas";

export type ReviewView = "clusters" | UnmatchedStatus;

const TABS: Array<{ view: ReviewView; label: string }> = [
  { view: "clusters", label: "Grupos" },
  { view: "pending", label: "Pendientes" },
  { view: "approved", label: "Aprobados" },
  { view: "rejected", label: "Rechazados" },
];

/** The clusters view ("Grupos") is the default view (no query string); the message lists are selected with `?status=`. */
export function reviewHref(view: ReviewView): string {
  return view === "clusters" ? "/training/review" : `/training/review?status=${view}`;
}

export function ReviewTabs({ active }: { active: ReviewView }) {
  return (
    <nav aria-label="Vistas de revisión" className="flex gap-1 overflow-x-auto border-b">
      {TABS.map((tab) => {
        const current = tab.view === active;
        return (
          <Link
            key={tab.view}
            href={reviewHref(tab.view)}
            aria-current={current ? "page" : undefined}
            className={
              current
                ? "border-b-2 border-primary px-3 py-2 text-sm font-medium whitespace-nowrap"
                : "px-3 py-2 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
