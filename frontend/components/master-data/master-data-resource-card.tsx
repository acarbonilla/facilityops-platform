import Link from "next/link";

import type { MasterDataResourceDefinition } from "@/lib/master-data/resources";

export interface MasterDataResourceCardProps {
  resource: MasterDataResourceDefinition;
}

export function MasterDataResourceCard({
  resource,
}: MasterDataResourceCardProps) {
  return (
    <Link
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
      href={resource.href}
    >
      <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
        Master data
      </p>
      <h2 className="mt-3 text-xl font-semibold text-slate-950">
        {resource.title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {resource.description}
      </p>
      <p className="mt-4 text-sm font-medium text-slate-900">
        Open read screen
      </p>
    </Link>
  );
}
