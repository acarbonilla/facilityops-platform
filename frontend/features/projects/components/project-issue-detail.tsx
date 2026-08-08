"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import {
  useDeleteProjectIssue,
  useProjectDetail,
  useProjectIssueDetail,
} from "@/hooks/use-projects";
import { usePermissions } from "@/hooks/use-permissions";
import {
  formatPersonLabel,
  formatProjectDate,
  formatProjectDateTime,
} from "@/lib/projects/display";
import {
  canCommentOnProjectIssue,
  canManageProjectIssues,
  formatProjectIssueError,
} from "@/lib/projects/issues-display";
import { readProjectIssueFormFlash } from "@/lib/projects/issues-form";

import { ProjectIssueAttachments } from "./project-issue-attachments";
import { ProjectIssueComments } from "./project-issue-comments";
import { ProjectIssueSeverityBadge } from "./project-issue-severity-badge";
import { ProjectIssueStatusBadge } from "./project-issue-status-badge";

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

export function ProjectIssueDetailScreen({
  projectId,
  issueId,
}: {
  projectId: string;
  issueId: string;
}) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const projectQuery = useProjectDetail(projectId);
  const detailQuery = useProjectIssueDetail(projectId, issueId);
  const deleteMutation = useDeleteProjectIssue(projectId);
  const router = useRouter();
  const [flash, setFlash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canManage =
    !permissionsLoading && canManageProjectIssues(hasPermission);
  const canComment =
    !permissionsLoading && canCommentOnProjectIssue(hasPermission);

  useEffect(() => {
    setFlash(readProjectIssueFormFlash());
  }, []);

  if (detailQuery.isPending || projectQuery.isPending) {
    return (
      <div
        className="h-48 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
        role="status"
      />
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        title="Unable to load issue"
        message={formatProjectIssueError(
          detailQuery.error,
          "Issue could not be loaded.",
        )}
      />
    );
  }

  const issue = detailQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        description={
          projectQuery.data
            ? `Issue on ${projectQuery.data.project_code}`
            : "Project issue detail"
        }
        eyebrow="Project issues"
        title={issue.title}
      >
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href={`/projects/${projectId}/issues`}
          >
            Back to issues
          </Link>
          {canManage ? (
            <>
              <Link
                className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                href={`/projects/${projectId}/issues/${issueId}/edit`}
              >
                Edit
              </Link>
              <button
                className="inline-flex items-center rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Delete this issue? This cannot be undone.",
                    )
                  ) {
                    return;
                  }
                  setErrorMessage(null);
                  void deleteMutation
                    .mutateAsync(issueId)
                    .then(() => {
                      router.replace(`/projects/${projectId}/issues`);
                      router.refresh();
                    })
                    .catch((error) => {
                      setErrorMessage(
                        formatProjectIssueError(
                          error,
                          "Issue could not be deleted.",
                        ),
                      );
                    });
                }}
                type="button"
              >
                Delete
              </button>
            </>
          ) : null}
        </div>
      </PageHeader>

      {flash ? (
        <p
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          {flash}
        </p>
      ) : null}
      {errorMessage ? (
        <ErrorState title="Issue action failed" message={errorMessage} />
      ) : null}

      <SectionCard title="Overview">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Status
            </dt>
            <dd className="mt-2">
              <ProjectIssueStatusBadge status={issue.status} />
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Severity
            </dt>
            <dd className="mt-2">
              <ProjectIssueSeverityBadge severity={issue.severity} />
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Owner
            </dt>
            <dd className="mt-2 text-sm font-medium text-slate-900">
              {formatPersonLabel(issue.owner_email, "Unassigned")}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Due date
            </dt>
            <dd className="mt-2 text-sm font-medium text-slate-900">
              {formatProjectDate(issue.due_date)}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Resolved at
            </dt>
            <dd className="mt-2 text-sm font-medium text-slate-900">
              {formatProjectDateTime(issue.resolved_at)}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Updated
            </dt>
            <dd className="mt-2 text-sm font-medium text-slate-900">
              {formatProjectDateTime(issue.updated_at)}
            </dd>
          </div>
        </dl>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Description
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
            {issue.description || "No description provided."}
          </p>
        </div>
      </SectionCard>

      <ProjectIssueComments
        canComment={canComment}
        comments={issue.comments ?? []}
        issueId={issueId}
        projectId={projectId}
      />

      <ProjectIssueAttachments
        issueId={issueId}
        issueStatus={issue.status}
      />
    </div>
  );
}
