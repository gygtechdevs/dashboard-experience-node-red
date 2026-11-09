import { Skeleton } from "@/components/ui/skeleton";

export function ReviewSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Cargando la cola de revisión">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
