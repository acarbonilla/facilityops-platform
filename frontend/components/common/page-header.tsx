import type { ReactNode } from "react";

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}

export function PageHeader({
  children,
  description,
  eyebrow,
  title,
}: PageHeaderProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {eyebrow ? (
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        {title}
      </h1>
      <p className="mt-3 max-w-3xl text-lg text-slate-600">{description}</p>
      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}
