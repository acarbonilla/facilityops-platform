import { APP_NAME } from "@/lib/constants";

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div>
        <p className="text-sm font-semibold text-slate-950">{APP_NAME}</p>
        <p className="text-xs text-slate-500">Operations workspace</p>
      </div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
        Foundation
      </span>
    </header>
  );
}
