"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { ErrorState } from "@/components/common/error-state";
import { FormActions } from "@/components/common/form-actions";
import { FormField } from "@/components/common/form-field";
import { FormValidationSummary } from "@/components/common/form-validation-summary";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectAssignmentPicker } from "@/features/projects/components/project-assignment-picker";
import {
  getFieldErrorMessage,
  TextAreaField,
  TextInputField,
} from "@/features/master-data/components/shared";
import {
  useCreateProjectTask,
  useProjectDetail,
  useProjectTaskDetail,
  useProjectTaskFormDefaults,
  useProjectTaskPicAssignmentOptions,
  useUpdateProjectTask,
} from "@/hooks/use-projects";
import { useUnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-prompt";
import {
  normalizeFormValidationError,
  type FormValidationResult,
} from "@/lib/api/form-validation";
import { createAssignmentOptionFallback } from "@/lib/projects/assignment-options";
import { formatProjectTaskError } from "@/lib/projects/tasks-display";
import {
  mapProjectTaskFormValuesToCreatePayload,
  mapProjectTaskFormValuesToUpdatePayload,
  validateProjectTaskFormValues,
  writeProjectTaskFormFlash,
} from "@/lib/projects/tasks-form";
import type { ProjectTaskFormValues } from "@/types/projects";

const requiredString = (fieldLabel: string) =>
  z.string().trim().min(1, `${fieldLabel} is required.`);

const projectTaskFormSchema = z
  .object({
    name: requiredString("Name"),
    description: z.string().trim(),
    person_in_charge: z.string().trim(),
    status: z.enum([
      "not_started",
      "in_progress",
      "blocked",
      "on_hold",
      "completed",
      "cancelled",
    ]),
    priority: z.enum(["low", "medium", "high", "critical"]),
    planned_start: z.string().trim(),
    planned_end: z.string().trim(),
    actual_start: z.string().trim(),
    actual_end: z.string().trim(),
    progress_percentage: z.string().trim(),
    sequence: z.string().trim(),
    is_milestone: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const errors = validateProjectTaskFormValues(values);
    (
      Object.entries(errors) as Array<
        [keyof ProjectTaskFormValues, string | undefined]
      >
    ).forEach(([field, message]) => {
      if (!message) {
        return;
      }
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path: [field],
      });
    });
  });

const STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

function TaskBreadcrumbs({
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
            href={`/projects/${projectId}/tasks`}
          >
            Tasks
          </Link>
        </li>
        <li>/</li>
        <li className="text-slate-700">{currentLabel}</li>
      </ol>
    </nav>
  );
}

function TaskFormLayout({
  children,
  description,
  projectId,
  title,
}: {
  children: ReactNode;
  description: string;
  projectId: string;
  title: string;
}) {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          description={description}
          eyebrow="Project tasks"
          title={title}
        >
          <TaskBreadcrumbs currentLabel={title} projectId={projectId} />
        </PageHeader>
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {children}
        </section>
      </div>
    </AppShell>
  );
}

function TaskFormSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <LoadingState
        message="Loading task form options and defaults."
        title="Loading task form"
      />
    </div>
  );
}

function ProjectTaskForm({
  cancelHref,
  initialValues,
  isSubmitting,
  onSubmit,
  projectId,
  projectSchedule,
  submitLabel,
}: {
  cancelHref: string;
  initialValues: ProjectTaskFormValues;
  isSubmitting: boolean;
  onSubmit: (values: ProjectTaskFormValues) => void | Promise<void>;
  projectId: string;
  projectSchedule?: {
    plannedStart?: string | null;
    plannedEnd?: string | null;
  };
  submitLabel: string;
}) {
  const [serverValidation, setServerValidation] =
    useState<FormValidationResult | null>(null);
  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
    setError,
    clearErrors,
    setValue,
    watch,
  } = useForm<ProjectTaskFormValues>({
    defaultValues: initialValues,
    resolver: zodResolver(projectTaskFormSchema),
  });

  const [picSearch, setPicSearch] = useState("");
  const [debouncedPicSearch, setDebouncedPicSearch] = useState("");
  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedPicSearch(picSearch.trim()),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [picSearch]);

  const picOptionsQuery = useProjectTaskPicAssignmentOptions(projectId, {
    search: debouncedPicSearch || undefined,
    page_size: 50,
  });

  useUnsavedChangesPrompt(isDirty && !isSubmitting);

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const isMilestone = watch("is_milestone");
  const personInCharge = watch("person_in_charge");
  const milestoneDate = watch("planned_start");
  const plannedEndWatch = watch("planned_end");
  const picFallback = useMemo(
    () =>
      createAssignmentOptionFallback({
        id: personInCharge || null,
        email: null,
        displayName: null,
        roleLabel: "Assigned",
      }),
    [personInCharge],
  );

  useEffect(() => {
    if (isMilestone && milestoneDate) {
      setValue("planned_end", milestoneDate, { shouldDirty: false });
    }
  }, [isMilestone, milestoneDate, setValue]);

  const handleMilestoneToggle = (event: ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    const start = milestoneDate.trim();
    const end = plannedEndWatch.trim();
    if (checked && start && end && start !== end) {
      const preferStart = window.confirm(
        "This task has different planned start and end dates. Use the planned start as the Milestone date?\n\nOK = use planned start\nCancel = use planned end",
      );
      const chosen = preferStart ? start : end;
      setValue("planned_start", chosen, { shouldDirty: true });
      setValue("planned_end", chosen, { shouldDirty: true });
    }
    setValue("is_milestone", checked, { shouldDirty: true });
  };

  return (
    <form
      className="space-y-6"
      onSubmit={handleSubmit(async (values) => {
        setServerValidation(null);
        clearErrors();
        try {
          await onSubmit(values);
        } catch (error) {
          const normalized = normalizeFormValidationError(error, {
            entityLabel: "Task",
            projectSchedule,
          });
          if (normalized.isExpected) {
            setServerValidation(normalized);
            for (const [field, message] of Object.entries(
              normalized.fieldErrors,
            )) {
              if (field in initialValues) {
                setError(field as keyof ProjectTaskFormValues, {
                  type: "server",
                  message,
                });
              }
            }
            return;
          }
          throw error;
        }
      })}
    >
      <FormValidationSummary result={serverValidation} />
      <section className="space-y-4" aria-labelledby="task-information-heading">
        <h2
          className="text-base font-semibold text-slate-950"
          id="task-information-heading"
        >
          Task information
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <TextInputField
            error={getFieldErrorMessage(errors.name?.message)}
            id="task-name"
            inputProps={register("name")}
            label="Name"
          />
          <SelectField
            error={getFieldErrorMessage(errors.status?.message)}
            id="task-status"
            label="Status"
            options={STATUS_OPTIONS}
            {...register("status")}
          />
          <SelectField
            error={getFieldErrorMessage(errors.priority?.message)}
            id="task-priority"
            label="Priority"
            options={PRIORITY_OPTIONS}
            {...register("priority")}
          />
          <TextInputField
            error={getFieldErrorMessage(errors.progress_percentage?.message)}
            id="task-progress"
            inputProps={register("progress_percentage")}
            label="Progress (%)"
            type="number"
          />
          <TextInputField
            error={getFieldErrorMessage(errors.sequence?.message)}
            id="task-sequence"
            inputProps={register("sequence")}
            label="Sequence"
            type="number"
          />
        </div>
        <p className="text-sm text-slate-600">
          Actual start and actual end are recorded automatically when work is
          started and completed. They cannot be typed on this form.
        </p>
        <input type="hidden" {...register("actual_start")} />
        <input type="hidden" {...register("actual_end")} />
        <TextAreaField
          error={getFieldErrorMessage(errors.description?.message)}
          id="task-description"
          label="Description"
          textAreaProps={register("description")}
        />
      </section>

      <section className="space-y-3" aria-labelledby="task-assignment-heading">
        <h2
          className="text-base font-semibold text-slate-950"
          id="task-assignment-heading"
        >
          Assignment
        </h2>
        <Controller
          control={control}
          name="person_in_charge"
          render={({ field }) => (
            <ProjectAssignmentPicker
              description="Assign an active Technician or the Project Manager. Assigning a Technician grants the minimum Project workspace access required for this task."
              disabled={isSubmitting}
              emptyMessage="No eligible Technicians found."
              error={getFieldErrorMessage(errors.person_in_charge?.message)}
              label="Person in charge"
              loading={picOptionsQuery.isPending}
              onChange={(value) => field.onChange(value ?? "")}
              onSearchChange={setPicSearch}
              options={picOptionsQuery.data?.results ?? []}
              search={picSearch}
              selectedOption={picFallback}
              statusMessage={
                picOptionsQuery.isError
                  ? "Eligible Technicians could not be loaded."
                  : undefined
              }
              value={field.value || null}
            />
          )}
        />
      </section>

      <section className="space-y-4" aria-labelledby="task-schedule-heading">
        <div>
          <h2
            className="text-base font-semibold text-slate-950"
            id="task-schedule-heading"
          >
            Planned schedule (optional)
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Set dates when this task needs to appear on the Project schedule and
            Gantt. Tasks without dates can still be assigned and completed.
          </p>
        </div>
        <FormField
          error={getFieldErrorMessage(errors.is_milestone?.message)}
          htmlFor="task-is-milestone"
          label="Milestone"
        >
          <label
            className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-700"
            htmlFor="task-is-milestone"
          >
            <input
              checked={isMilestone}
              className="h-4 w-4 rounded border-slate-300"
              id="task-is-milestone"
              onChange={handleMilestoneToggle}
              type="checkbox"
            />
            This task is a milestone
          </label>
        </FormField>
        {isMilestone ? (
          <TextInputField
            error={getFieldErrorMessage(
              errors.planned_start?.message || errors.planned_end?.message,
            )}
            id="task-milestone-date"
            inputProps={register("planned_start")}
            label="Milestone date"
            type="date"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <TextInputField
              error={getFieldErrorMessage(errors.planned_start?.message)}
              id="task-planned-start"
              inputProps={register("planned_start")}
              label="Planned start"
              type="date"
            />
            <TextInputField
              error={getFieldErrorMessage(errors.planned_end?.message)}
              id="task-planned-end"
              inputProps={register("planned_end")}
              label="Planned end"
              type="date"
            />
          </div>
        )}
      </section>

      <FormActions
        cancelHref={cancelHref}
        isSubmitting={isSubmitting}
        submitLabel={submitLabel}
      />
    </form>
  );
}

function TaskProtectedFormState({
  children,
  requiredPermissions,
}: {
  children: ReactNode;
  requiredPermissions: string[];
}) {
  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={requiredPermissions}
    >
      {children}
    </ProtectedPermissionRoute>
  );
}

export function ProjectTaskCreatePageContent({
  projectId,
}: {
  projectId: string;
}) {
  const projectQuery = useProjectDetail(projectId);
  const defaultValues = useProjectTaskFormDefaults();
  const mutation = useCreateProjectTask(projectId);
  const router = useRouter();

  if (projectQuery.isPending) {
    return (
      <TaskProtectedFormState
        requiredPermissions={[
          "projects.tasks.create",
          "projects.manage",
          "projects.tasks.manage",
        ]}
      >
        <AppShell>
          <TaskFormSkeleton />
        </AppShell>
      </TaskProtectedFormState>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <TaskProtectedFormState
        requiredPermissions={[
          "projects.tasks.create",
          "projects.manage",
          "projects.tasks.manage",
        ]}
      >
        <AppShell>
          <ErrorState
            message={formatProjectTaskError(
              projectQuery.error,
              "Project could not be loaded for task creation.",
            )}
            title="Unable to load task form"
          />
        </AppShell>
      </TaskProtectedFormState>
    );
  }

  return (
    <TaskProtectedFormState
      requiredPermissions={[
        "projects.tasks.create",
        "projects.manage",
        "projects.tasks.manage",
      ]}
    >
      <TaskFormLayout
        description={`Create a task under ${projectQuery.data.project_code}. Assignment is optional until the task moves to in progress.`}
        projectId={projectId}
        title="New Task"
      >
        <ProjectTaskForm
          cancelHref={`/projects/${projectId}/tasks`}
          initialValues={defaultValues}
          isSubmitting={mutation.isPending}
          onSubmit={async (values) => {
            const task = await mutation.mutateAsync(
              mapProjectTaskFormValuesToCreatePayload(values),
            );
            writeProjectTaskFormFlash("Task created successfully.");
            router.replace(`/projects/${projectId}/tasks/${task.id}`);
            router.refresh();
          }}
          projectId={projectId}
          projectSchedule={{
            plannedStart: projectQuery.data.planned_start_date,
            plannedEnd: projectQuery.data.planned_end_date,
          }}
          submitLabel="Create task"
        />
      </TaskFormLayout>
    </TaskProtectedFormState>
  );
}

export function ProjectTaskEditPageContent({
  projectId,
  taskId,
}: {
  projectId: string;
  taskId: string;
}) {
  const projectQuery = useProjectDetail(projectId);
  const detailQuery = useProjectTaskDetail(projectId, taskId);
  const mutation = useUpdateProjectTask(projectId, taskId);
  const router = useRouter();
  const defaultValues = useProjectTaskFormDefaults(detailQuery.data);

  if (projectQuery.isPending || detailQuery.isPending) {
    return (
      <TaskProtectedFormState
        requiredPermissions={[
          "projects.tasks.update",
          "projects.manage",
          "projects.tasks.manage",
        ]}
      >
        <AppShell>
          <TaskFormSkeleton />
        </AppShell>
      </TaskProtectedFormState>
    );
  }

  if (
    projectQuery.isError ||
    detailQuery.isError ||
    !projectQuery.data ||
    !detailQuery.data
  ) {
    return (
      <TaskProtectedFormState
        requiredPermissions={[
          "projects.tasks.update",
          "projects.manage",
          "projects.tasks.manage",
        ]}
      >
        <AppShell>
          <ErrorState
            message={formatProjectTaskError(
              detailQuery.error ?? projectQuery.error,
              "Task form could not be loaded.",
            )}
            title="Unable to load task form"
          />
        </AppShell>
      </TaskProtectedFormState>
    );
  }

  return (
    <TaskProtectedFormState
      requiredPermissions={[
        "projects.tasks.update",
        "projects.manage",
        "projects.tasks.manage",
      ]}
    >
      <TaskFormLayout
        description={`Edit ${detailQuery.data.task_code}. Person in charge is required before in progress or completed.`}
        projectId={projectId}
        title="Edit Task"
      >
        <ProjectTaskForm
          cancelHref={`/projects/${projectId}/tasks/${taskId}`}
          initialValues={defaultValues}
          isSubmitting={mutation.isPending}
          onSubmit={async (values) => {
            const task = await mutation.mutateAsync(
              mapProjectTaskFormValuesToUpdatePayload(values),
            );
            writeProjectTaskFormFlash("Task updated successfully.");
            router.replace(`/projects/${projectId}/tasks/${task.id}`);
            router.refresh();
          }}
          projectId={projectId}
          projectSchedule={{
            plannedStart: projectQuery.data.planned_start_date,
            plannedEnd: projectQuery.data.planned_end_date,
          }}
          submitLabel="Save changes"
        />
      </TaskFormLayout>
    </TaskProtectedFormState>
  );
}
