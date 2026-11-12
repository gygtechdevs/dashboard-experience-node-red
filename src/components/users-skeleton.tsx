import { Skeleton } from "@/components/ui/skeleton";

export function UsersSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Cargando usuarios">
      <div className="flex justify-end">
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="grid gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
