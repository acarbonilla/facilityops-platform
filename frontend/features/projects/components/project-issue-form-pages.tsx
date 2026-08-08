"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { FormActions } from "@/components/common/form-actions";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import { AppShell } from "@/components/layout/app-shell";
import {
  getFieldErrorMessage,
  TextAreaField,
  TextInputField,
} from "@/features/master-data/components/shared";
import {
  useCreateProjectIssue,
  useProjectDetail,
  useProjectIssueDetail,
  useProjectIssueFormDefaults,
  useProjectMembers,
  useUpdateProjectIssue,
} from "@/hooks/use-projects";
import { useUnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-prompt";
import { formatProjectLabel } from "@/lib/projects/display";
import { formatProjectIssueError } from "@/lib/projects/issues-display";
import {
  mapProjectIssueFormValuesToCreatePayload,
  mapProjectIssueFormValuesToUpdatePayload,
  validateProjectIssueFormValues,
  writeProjectIssueFormFlash,
} from "@/lib/projects/issues-form";
import type { ProjectIssueFormValues, ProjectMember } from "@/types/projects";

const projectIssueFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required."),
    description: z.string().trim(),
    severity: z.enum(["low", "medium", "high", "critical"]),
    status: z.enum([
      "open",
      "investigating",
      "blocked",
      "resolved",
      "closed",
      "cancelled",
    ]),
    owner: z.string().trim(),
    due_date: z.string().trim(),
  })
  .superRefine((values, ctx) => {
    const errors = validateProjectIssueFormValues(values);
    (
      Object.entries(errors) as Array<
        [keyof ProjectIssueFormValues, string | undefined]
      >
    ).forEach(([field, message]) => {
      if (!message) return;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path: [field],
      });
    });
  });

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "investigating", label: "Investigating" },
  { value: "blocked", label: "Blocked" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

const SEVERITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

function IssueBreadcrumbs({
  projectId,
  currentLabel,
}: {
  projectId: string;
  currentLabel: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link className="hover:text-slate-700" href="/projects">
            Projects
          </Link>
        </li>
        <li>/</li>
        <li>
          <Link
            className="hover:text-slate-700"
            href={`/projects/${projectId}`}
          >
            Project
          </Link>
        </li>
        <li>/</li>
        <li>
          <Link
            className="hover:text-slate-700"
            href={`/projects/${projectId}/issues`}
          >
            Issues
          </Link>
        </li>
        <li>/</li>
        <li className="font-medium text-slate-700">{currentLabel}</li>
      </ol>
    </nav>
  );
}

function IssueFormLayout({
  children,
  description,
  errorMessage,
  projectId,
  title,
}: {
  children: ReactNode;
  description: string;
  errorMessage?: string | null;
  projectId: string;
  title: string;
}) {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          description={description}
          eyebrow="Project issues"
          title={title}
        >
          <IssueBreadcrumbs currentLabel={title} projectId={projectId} />
        </PageHeader>
        {errorMessage ? (
          <ErrorState message={errorMessage} title="Unable to save issue" />
        ) : null}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {children}
        </section>
      </div>
    </AppShell>
  );
}

function IssueProtectedFormState({ children }: { children: ReactNode }) {
  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={["projects.issues.manage", "projects.manage"]}
    >
      {children}
    </ProtectedPermissionRoute>
  );
}

function buildOwnerOptions(
  members: ProjectMember[],
  projectManagerId: string | null | undefined,
  projectManagerEmail: string | null | undefined,
) {
  const options = members
    .filter((member) => member.is_active)
    .map((member) => ({
      value: member.user,
      label: `${member.user_name || member.user_email} (${member.user_email}) — ${formatProjectLabel(member.role)}`,
    }));

  if (
    projectManagerId &&
    !options.some((option) => option.value === projectManagerId)
  ) {
    options.unshift({
      value: projectManagerId,
      label: `${projectManagerEmail || "Project manager"} — Project Manager`,
    });
  }

  return options;
}

function ProjectIssueForm({
  cancelHref,
  initialValues,
  isSubmitting,
  members,
  membersEmptyHref,
  onSubmit,
  ownerOptions,
  submitLabel,
}: {
  cancelHref: string;
  initialValues: ProjectIssueFormValues;
  isSubmitting: boolean;
  members: ProjectMember[];
  membersEmptyHref: string;
  onSubmit: (values: ProjectIssueFormValues) => void | Promise<void>;
  ownerOptions: Array<{ value: string; label: string }>;
  submitLabel: string;
}) {
  const {
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
  } = useForm<ProjectIssueFormValues>({
    defaultValues: initialValues,
    resolver: zodResolver(projectIssueFormSchema),
  });

  useUnsavedChangesPrompt(isDirty && !isSubmitting);

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  return (
    <form
      className="space-y-6"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values);
      })}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <TextInputField
          error={getFieldErrorMessage(errors.title?.message)}
          id="issue-title"
          inputProps={register("title")}
          label="Title"
        />
        <SelectField
          error={getFieldErrorMessage(errors.status?.message)}
          id="issue-status"
          label="Status"
          options={STATUS_OPTIONS}
          {...register("status")}
        />
        <SelectField
          error={getFieldErrorMessage(errors.severity?.message)}
          id="issue-severity"
          label="Severity"
          options={SEVERITY_OPTIONS}
          {...register("severity")}
        />
        <TextInputField
          error={getFieldErrorMessage(errors.due_date?.message)}
          id="issue-due-date"
          inputProps={register("due_date")}
          label="Due date"
          type="date"
        />
      </div>

      <TextAreaField
        error={getFieldErrorMessage(errors.description?.message)}
        id="issue-description"
        label="Description"
        textAreaProps={register("description")}
      />

      <div className="space-y-3">
        <SelectField
          description="Owner should be an active project member or the project manager."
          error={getFieldErrorMessage(errors.owner?.message)}
          id="issue-owner"
          label="Owner"
          options={ownerOptions}
          placeholder="Unassigned"
          {...register("owner")}
        />
        {members.length === 0 && ownerOptions.length === 0 ? (
          <EmptyState
            message="Add project members before assigning an issue owner."
            title="No assignable members"
            action={
              <Link
                className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href={membersEmptyHref}
              >
                Open project
              </Link>
            }
          />
        ) : null}
      </div>

      <FormActions
        cancelHref={cancelHref}
        isSubmitting={isSubmitting}
        submitLabel={submitLabel}
      />
    </form>
  );
}

export function ProjectIssueCreatePageContent({
  projectId,
}: {
  projectId: string;
}) {
  const projectQuery = useProjectDetail(projectId);
  const membersQuery = useProjectMembers(projectId);
  const defaultValues = useProjectIssueFormDefaults();
  const mutation = useCreateProjectIssue(projectId);
  const router = useRouter();

  const ownerOptions = useMemo(
    () =>
      buildOwnerOptions(
        membersQuery.data?.results ?? [],
        projectQuery.data?.project_manager,
        projectQuery.data?.project_manager_email,
      ),
    [membersQuery.data?.results, projectQuery.data],
  );

  if (projectQuery.isPending || membersQuery.isPending) {
    return (
      <IssueProtectedFormState>
        <AppShell>
          <LoadingState
            message="Loading project for issue creation."
            title="Loading issue form"
          />
        </AppShell>
      </IssueProtectedFormState>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <IssueProtectedFormState>
        <AppShell>
          <ErrorState
            message={formatProjectIssueError(
              projectQuery.error,
              "Project could not be loaded for issue creation.",
            )}
            title="Unable to load issue form"
          />
        </AppShell>
      </IssueProtectedFormState>
    );
  }

  return (
    <IssueProtectedFormState>
      <IssueFormLayout
        description={`Create an issue under ${projectQuery.data.project_code}.`}
        errorMessage={
          mutation.isError
            ? formatProjectIssueError(
                mutation.error,
                "Issue could not be created.",
              )
            : null
        }
        projectId={projectId}
        title="New Issue"
      >
        <ProjectIssueForm
          cancelHref={`/projects/${projectId}/issues`}
          initialValues={defaultValues}
          isSubmitting={mutation.isPending}
          members={membersQuery.data?.results ?? []}
          membersEmptyHref={`/projects/${projectId}`}
          onSubmit={async (values) => {
            const issue = await mutation.mutateAsync(
              mapProjectIssueFormValuesToCreatePayload(values),
            );
            writeProjectIssueFormFlash("Issue created successfully.");
            router.replace(`/projects/${projectId}/issues/${issue.id}`);
            router.refresh();
          }}
          ownerOptions={ownerOptions}
          submitLabel="Create issue"
        />
      </IssueFormLayout>
    </IssueProtectedFormState>
  );
}

export function ProjectIssueEditPageContent({
  projectId,
  issueId,
}: {
  projectId: string;
  issueId: string;
}) {
  const projectQuery = useProjectDetail(projectId);
  const detailQuery = useProjectIssueDetail(projectId, issueId);
  const membersQuery = useProjectMembers(projectId);
  const mutation = useUpdateProjectIssue(projectId, issueId);
  const router = useRouter();
  const defaultValues = useProjectIssueFormDefaults(detailQuery.data);

  const ownerOptions = useMemo(
    () =>
      buildOwnerOptions(
        membersQuery.data?.results ?? [],
        projectQuery.data?.project_manager,
        projectQuery.data?.project_manager_email,
      ),
    [membersQuery.data?.results, projectQuery.data],
  );

  if (
    projectQuery.isPending ||
    detailQuery.isPending ||
    membersQuery.isPending
  ) {
    return (
      <IssueProtectedFormState>
        <AppShell>
          <LoadingState
            message="Loading issue for editing."
            title="Loading issue form"
          />
        </AppShell>
      </IssueProtectedFormState>
    );
  }

  if (
    projectQuery.isError ||
    detailQuery.isError ||
    !projectQuery.data ||
    !detailQuery.data
  ) {
    return (
      <IssueProtectedFormState>
        <AppShell>
          <ErrorState
            message={formatProjectIssueError(
              detailQuery.error ?? projectQuery.error,
              "Issue form could not be loaded.",
            )}
            title="Unable to load issue form"
          />
        </AppShell>
      </IssueProtectedFormState>
    );
  }

  return (
    <IssueProtectedFormState>
      <IssueFormLayout
        description={`Edit issue under ${projectQuery.data.project_code}. Resolved/closed timestamps are set by the backend.`}
        errorMessage={
          mutation.isError
            ? formatProjectIssueError(
                mutation.error,
                "Issue could not be updated.",
              )
            : null
        }
        projectId={projectId}
        title="Edit Issue"
      >
        <ProjectIssueForm
          cancelHref={`/projects/${projectId}/issues/${issueId}`}
          initialValues={defaultValues}
          isSubmitting={mutation.isPending}
          members={membersQuery.data?.results ?? []}
          membersEmptyHref={`/projects/${projectId}`}
          onSubmit={async (values) => {
            const issue = await mutation.mutateAsync(
              mapProjectIssueFormValuesToUpdatePayload(values),
            );
            writeProjectIssueFormFlash("Issue updated successfully.");
            router.replace(`/projects/${projectId}/issues/${issue.id}`);
            router.refresh();
          }}
          ownerOptions={ownerOptions}
          submitLabel="Save changes"
        />
      </IssueFormLayout>
    </IssueProtectedFormState>
  );
}
