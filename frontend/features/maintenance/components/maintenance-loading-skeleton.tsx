export function MaintenanceLoadingSkeleton({
  cards = 3,
  rows = 4,
}: {
  cards?: number;
  rows?: number;
}) {
  return (
    <div className="space-y-6" role="status">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cards }).map((_, index) => (
          <div
            className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
            key={`card-${index}`}
          />
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              className="h-12 animate-pulse rounded-lg bg-slate-100"
              key={`row-${index}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
