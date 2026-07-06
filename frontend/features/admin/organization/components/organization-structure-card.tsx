import Link from "next/link";

export interface OrganizationStructureCardProps {
  href: string;
  title: string;
  description: string;
  count?: number;
  createHref?: string;
  canManage?: boolean;
}

export function OrganizationStructureCard({
  href,
  title,
  description,
  count,
  createHref,
  canManage = false,
}: OrganizationStructureCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
        Organization
      </p>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
          {count ?? "…"}
        </span>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          href={href}
        >
          Open screen
        </Link>
        {canManage && createHref ? (
          <Link
            className="inline-flex items-center rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
            href={createHref}
          >
            Create new
          </Link>
        ) : null}
      </div>
    </article>
  );
}
