type ActivityItem = {
  id: string;
  type: string;
  detail: string;
  actor: string;
  time: string;
};

export function PreviewActivityList({ items }: { items: readonly ActivityItem[] }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-display text-sm font-semibold text-slate-950">
        Recent activity
      </h3>
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-950">
                <span>{item.type}</span>
                <span className="font-normal text-slate-400"> · {item.time}</span>
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-600">{item.detail}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{item.actor}</p>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
