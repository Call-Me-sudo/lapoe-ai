import { Skeleton } from "@/components/ui/skeleton";

/**
 * Generic placeholders shown while dashboard data is loading.
 * Designed to roughly match the height/shape of common list & card layouts
 * so the page doesn't visibly "jump" when real data arrives.
 */

export function ListSkeleton({ rows = 4, withMeta = true }: { rows?: number; withMeta?: boolean }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-md shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              {withMeta && <Skeleton className="h-3 w-3/5" />}
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface-card p-4 space-y-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function CardBlockSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div className="surface-card p-5 space-y-4">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-3 w-1/4" />
      <Skeleton className="w-full rounded-md" style={{ height }} />
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="divide-y divide-border/40">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-3 flex items-center gap-3">
            {Array.from({ length: cols }).map((__, c) => (
              <Skeleton key={c} className={`h-4 ${c === 0 ? "w-1/4" : "flex-1"}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
