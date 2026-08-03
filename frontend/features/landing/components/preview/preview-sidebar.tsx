import { LIVE_PLATFORM_PREVIEW } from "@/lib/landing/live-platform-preview";
import { cn } from "@/lib/utils";

export function PreviewSidebar({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "hidden w-48 shrink-0 flex-col border-r border-slate-800 bg-slate-950 p-3 text-slate-300 lg:flex",
        className,
      )}
      aria-hidden="true"
    >
      <div className="mb-4 flex items-center gap-2 px-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-sky-400 to-teal-500 text-xs font-bold text-slate-950">
          F
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {LIVE_PLATFORM_PREVIEW.shell.brand}
          </p>
          <p className="truncate text-[10px] text-slate-500">Modules</p>
        </div>
      </div>
      <ul className="space-y-0.5">
        {LIVE_PLATFORM_PREVIEW.sidebar.map((item) => (
          <li key={item.id}>
            <span
              className={cn(
                "block rounded-md px-2.5 py-2 text-xs font-medium",
                item.active
                  ? "bg-slate-800 text-white"
                  : "text-slate-400",
              )}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
