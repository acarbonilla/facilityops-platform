"use client";

import Link from "next/link";

import { usePermissions } from "@/hooks/use-permissions";
import {
  formatProjectLinkRelationshipLabel,
  canOpenLinkedProject,
  hasLinkedProjects,
} from "@/lib/projects/links";
import type { ProjectLinkedProjectSummary, ProjectStatus } from "@/types/projects";
import { ProjectStatusBadge } from "./project-status-badge";

type LinkedProjectLike = {
  id: string;
  project_code: string;
  name: string;
  status: string;
  link_id: string;
  relationship: string;
  link_type: string;
};

export function LinkedProjectsSection({
  linkedProjects,
  description = "Projects that reference this operational record. Visibility is limited to projects you can access.",
}: {
  linkedProjects?: LinkedProjectLike[] | null;
  description?: string;
}) {
  const { hasPermission, permissionsLoading } = usePermissions();

  if (!hasLinkedProjects(linkedProjects as ProjectLinkedProjectSummary[] | undefined)) {
    return null;
  }

  const canOpen =
    !permissionsLoading && canOpenLinkedProject(hasPermission);

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          Linked Projects
        </h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <ul className="space-y-3">
        {linkedProjects!.map((project) => (
          <li
            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            key={project.link_id}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {project.project_code}
                </p>
                <p className="mt-1 text-base font-semibold text-slate-950">
                  {project.name}
                </p>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      Status
                    </dt>
                    <dd className="mt-1">
                      <ProjectStatusBadge
                        status={project.status as ProjectStatus}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      Relationship
                    </dt>
                    <dd className="mt-1 text-slate-800">
                      {formatProjectLinkRelationshipLabel(project.relationship)}
                    </dd>
                  </div>
                </dl>
              </div>
              {canOpen ? (
                <Link
                  className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  href={`/projects/${project.id}`}
                >
                  Open project
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
