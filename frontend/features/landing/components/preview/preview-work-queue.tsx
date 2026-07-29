import { cn } from "@/lib/utils";

type WorkQueueItem = {
  id: string;
  reference: string;
  title: string;
  priority: string;
  status: string;
  assignee: string;
  due: string;
};

function priorityClass(priority: string) {
  if (priority === "High") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority === "Medium") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function statusClass(status: string) {
  if (status === "Completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Assigned" || status === "In review") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function PreviewWorkQueue({ items }: { items: readonly WorkQueueItem[] }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-slate-950">
          Work queue
        </h3>
        <span className="text-[11px] font-medium text-slate-400">
          Sample rows
        </span>
      </div>

      {/* Desktop / tablet table */}
      <div className="mt-3 hidden overflow-hidden rounded-lg border border-slate-100 md:block">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Reference</th>
              <th className="px-3 py-2 font-medium">Priority</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Assignee</th>
              <th className="px-3 py-2 font-medium">Due</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="max-w-[14rem] px-3 py-2.5">
                  <p className="font-medium text-slate-950">{item.reference}</p>
                  <p className="truncate text-slate-500">{item.title}</p>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      priorityClass(item.priority),
                    )}
                  >
                    {item.priority}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      statusClass(item.status),
                    )}
                  >
                    {item.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-600">{item.assignee}</td>
                <td className="px-3 py-2.5 text-slate-600">{item.due}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <ul className="mt-3 space-y-2 md:hidden">
        {items.slice(0, 3).map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-slate-100 bg-slate-50/80 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-950">{item.reference}</p>
                <p className="truncate text-xs text-slate-500">{item.title}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  priorityClass(item.priority),
                )}
              >
                {item.priority}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              <span className="font-medium text-slate-700">{item.status}</span>
              {" · "}
              {item.assignee}
              {" · "}
              Due {item.due}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}
