import { Skeleton } from "@/components/ui/skeleton";

export function IntentsSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Cargando intenciones">
      <div className="flex justify-between gap-3">
        <Skeleton className="h-8 w-full sm:w-80" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
