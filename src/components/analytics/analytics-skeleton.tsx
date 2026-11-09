import { Skeleton } from "@/components/ui/skeleton";

export function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Cargando analítica">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-12 w-36" />
        <Skeleton className="h-12 w-36" />
        <Skeleton className="h-12 w-40" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full lg:col-span-2" />
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  );
}
