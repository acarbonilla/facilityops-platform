"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import {
  useDeleteProject,
  useProjectDetail,
} from "@/hooks/use-projects";
import { usePermissions } from "@/hooks/use-permissions";
import {
  canDeleteProject,
  canUpdateProject,
  formatPersonLabel,
  formatProjectCompletion,
  formatProjectDate,
  formatProjectDateTime,
  formatProjectError,
  formatProjectLabel,
} from "@/lib/projects/display";
import { readProjectFormFlash } from "@/lib/projects/form";
import type { ProjectHistory, ProjectMember } from "@/types/projects";

import { ProjectAttachments } from "./project-attachments";
import { ProjectPriorityBadge } from "./project-priority-badge";
import { ProjectStatusBadge } from "./project-status-badge";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function MetadataList({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          key={item.label}
        >
          <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {item.label}
          </dt>
          <dd className="mt-2 text-sm font-medium text-slate-900">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function MembersSummary({ members }: { members: ProjectMember[] }) {
  if (members.length === 0) {
    return (
      <EmptyState
        title="No members yet"
        message="Project members will appear here once they are assigned."
      />
    );
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
      {members.map((member) => (
        <li
          className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          key={member.id}
        >
          <div>
            <p className="font-medium text-slate-900">
              {member.user_name || member.user_email}
            </p>
            <p className="text-sm text-slate-600">{member.user_email}</p>
          </div>
          <p className="text-sm font-medium text-slate-700">
            {formatProjectLabel(member.role)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function HistorySummary({ entries }: { entries: ProjectHistory[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="No history yet"
        message="Project activity will appear here as the record changes."
      />
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li
          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          key={entry.id}
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium text-slate-900">
                {formatProjectLabel(entry.action)}
              </p>
              <p className="mt-1 text-sm text-slate-700">{entry.description}</p>
            </div>
            <p className="shrink-0 text-xs text-slate-500">
              {formatProjectDateTime(entry.created_at)}
            </p>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {formatPersonLabel(entry.actor_email, "System")}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function ProjectDetailScreen({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { hasPermission, permissionsLoading } = usePermissions();
  const detailQuery = useProjectDetail(projectId);
  const deleteMutation = useDeleteProject();
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setFlashMessage(readProjectFormFlash());
  }, []);

  if (detailQuery.isPending) {
    return (
      <div className="space-y-6" role="status">
        <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        title="Unable to load project"
        message={formatProjectError(
          detailQuery.error,
          "The selected project could not be loaded.",
        )}
        action={
          <button
            className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
            onClick={() => void detailQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        }
      />
    );
  }

  const project = detailQuery.data;
  const canEdit = !permissionsLoading && canUpdateProject(hasPermission);
  const canDelete = !permissionsLoading && canDeleteProject(hasPermission);

  return (
    <div className="space-y-6">
      {flashMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {flashMessage}
        </div>
      ) : null}
      {deleteError ? (
        <ErrorState
          title="Unable to delete project"
          message={deleteError}
        />
      ) : null}

      <PageHeader
        description={`Project ${project.project_code}. Overview of ownership, schedule, completion, members, attachments, and recent history.`}
        eyebrow="Projects"
        title={project.name}
      >
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href="/projects"
          >
            Back to projects
          </Link>
          {canEdit ? (
            <Link
              className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              href={`/projects/${project.id}/edit`}
            >
              Edit project
            </Link>
          ) : null}
          {canDelete ? (
            <button
              className="inline-flex items-center rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={deleteMutation.isPending}
              onClick={() => {
                const confirmed = window.confirm(
                  `Delete project ${project.project_code}? This soft-deletes the project record.`,
                );
                if (!confirmed) {
                  return;
                }
                setDeleteError(null);
                void deleteMutation
                  .mutateAsync(project.id)
                  .then(() => {
                    router.replace("/projects");
                    router.refresh();
                  })
                  .catch((error: unknown) => {
                    setDeleteError(
                      formatProjectError(error, "Project could not be deleted."),
                    );
                  });
              }}
              type="button"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </button>
          ) : null}
        </div>
      </PageHeader>

      <SectionCard
        description="Lifecycle status, priority, and completion are read from the project record."
        title="Overview"
      >
        <div className="flex flex-wrap items-center gap-3">
          <ProjectStatusBadge status={project.status} />
          <ProjectPriorityBadge priority={project.priority} />
          <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
            {formatProjectCompletion(project.completion_percentage)} complete
          </span>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">
          {project.description?.trim() || "No description provided."}
        </p>
      </SectionCard>

      <SectionCard title="Project information">
        <MetadataList
          items={[
            { label: "Project code", value: project.project_code },
            { label: "Organization", value: project.organization_name },
            {
              label: "Building",
              value: project.building_name || "Not assigned",
            },
            {
              label: "Project manager",
              value: formatPersonLabel(project.project_manager_email),
            },
            {
              label: "Planned start",
              value: formatProjectDate(project.planned_start_date),
            },
            {
              label: "Planned end",
              value: formatProjectDate(project.planned_end_date),
            },
            {
              label: "Actual start",
              value: formatProjectDate(project.actual_start_date),
            },
            {
              label: "Actual end",
              value: formatProjectDate(project.actual_end_date),
            },
            {
              label: "Created",
              value: formatProjectDateTime(project.created_at),
            },
            {
              label: "Updated",
              value: formatProjectDateTime(project.updated_at),
            },
          ]}
        />
      </SectionCard>

      <SectionCard
        description="Active members from the project detail payload."
        title="Members"
      >
        <MembersSummary members={project.members ?? []} />
      </SectionCard>

      <ProjectAttachments
        projectId={project.id}
        projectStatus={project.status}
      />

      <SectionCard
        description="Recent history entries returned with the project detail."
        title="History"
      >
        <HistorySummary entries={project.recent_history ?? []} />
      </SectionCard>
    </div>
  );
}
