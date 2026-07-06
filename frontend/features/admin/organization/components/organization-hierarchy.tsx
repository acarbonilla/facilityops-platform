import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import type { OrganizationStructureNode } from "@/types/master-data";

function resourceLabel(resource: OrganizationStructureNode["resource"]): string {
  switch (resource) {
    case "tenants":
      return "Tenant";
    case "organizations":
      return "Organization";
    case "departments":
      return "Department";
    case "buildings":
      return "Building";
    case "floors":
      return "Floor";
    case "areas":
      return "Area";
  }
}

function HierarchyBranch({ node }: { node: OrganizationStructureNode }) {
  return (
    <li className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">
              {resourceLabel(node.resource)}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">{node.label}</p>
            <p className="mt-1 font-mono text-xs text-slate-500">{node.code}</p>
          </div>
          <Link
            className="text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950"
            href={node.href}
          >
            Open list
          </Link>
        </div>
      </div>
      {node.children.length > 0 ? (
        <ul className="ml-4 space-y-3 border-l border-dashed border-slate-300 pl-4">
          {node.children.map((child) => (
            <HierarchyBranch key={child.id} node={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function OrganizationHierarchy({
  nodes,
}: {
  nodes: OrganizationStructureNode[];
}) {
  if (nodes.length === 0) {
    return (
      <EmptyState
        title="No hierarchy available"
        message="The organization structure cannot be visualized until tenant and related master-data records exist."
      />
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
          Read-only hierarchy
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          Organization Structure
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Tenant to area visualization based on the existing master-data
          foundation. This view stays intentionally simple and read-only.
        </p>
      </div>
      <ul className="space-y-4">
        {nodes.map((node) => (
          <HierarchyBranch key={node.id} node={node} />
        ))}
      </ul>
    </section>
  );
}
