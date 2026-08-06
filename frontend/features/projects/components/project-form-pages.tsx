"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { ErrorState } from "@/components/common/error-state";
import { FormActions } from "@/components/common/form-actions";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import { UserDirectoryPicker } from "@/components/common/user-directory-picker";
import { AppShell } from "@/components/layout/app-shell";
import {
  buildRecordOptions,
  filterBuildingsByOrganization,
  getFieldErrorMessage,
  TextAreaField,
  TextInputField,
} from "@/features/master-data/components/shared";
import { usePermissions } from "@/hooks/use-permissions";
import {
  useCreateProject,
  useProjectDetail,
  useProjectFormDefaults,
  useProjectFormOptions,
  useUpdateProject,
} from "@/hooks/use-projects";
import { useUnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-prompt";
import { formatProjectError } from "@/lib/projects/display";
import {
  mapProjectFormValuesToCreatePayload,
  mapProjectFormValuesToUpdatePayload,
  validateProjectDateRanges,
  writeProjectFormFlash,
} from "@/lib/projects/form";
import { createUserDirectoryEmailFallback } from "@/lib/users/directory";
import type {
  ProjectFormOptions,
  ProjectFormValues,
} from "@/types/projects";

const requiredString = (fieldLabel: string) =>
  z.string().trim().min(1, `${fieldLabel} is required.`);

const projectFormSchema = z
  .object({
    organization: requiredString("Organization"),
    building: z.string().trim(),
    project_code: z.string().trim(),
    name: requiredString("Name"),
    description: z.string().trim(),
    project_manager: z.string().trim(),
    status: z.enum([
      "draft",
      "planned",
      "in_progress",
      "on_hold",
      "delayed",
      "completed",
      "cancelled",
    ]),
    priority: z.enum(["low", "medium", "high", "critical"]),
    planned_start_date: z.string().trim(),
    planned_end_date: z.string().trim(),
    actual_start_date: z.string().trim(),
    actual_end_date: z.string().trim(),
  })
  .superRefine((values, ctx) => {
    const dateErrors = validateProjectDateRanges(values);
    if (dateErrors.planned_end_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: dateErrors.planned_end_date,
        path: ["planned_end_date"],
      });
    }
    if (dateErrors.actual_end_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: dateErrors.actual_end_date,
        path: ["actual_end_date"],
      });
    }
  });

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "delayed", label: "Delayed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

function ProjectBreadcrumbs({ currentLabel }: { currentLabel: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link className="hover:text-slate-700" href="/projects">
            Projects
          </Link>
        </li>
        <li>/</li>
        <li className="text-slate-700">{currentLabel}</li>
      </ol>
    </nav>
  );
}

function ProjectFormLayout({
  children,
  description,
  errorMessage,
  title,
}: {
  children: ReactNode;
  description: string;
  errorMessage?: string | null;
  title: string;
}) {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          description={description}
          eyebrow="Projects"
          title={title}
        >
          <ProjectBreadcrumbs currentLabel={title} />
        </PageHeader>
        {errorMessage ? (
          <ErrorState message={errorMessage} title="Unable to save project" />
        ) : null}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {children}
        </section>
      </div>
    </AppShell>
  );
}

function ProjectFormSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <LoadingState
        message="Loading project form options and defaults."
        title="Loading project form"
      />
    </div>
  );
}

function ProjectForm({
  cancelHref,
  formOptions,
  initialValues,
  isSubmitting,
  onSubmit,
  projectManagerLabel,
  submitLabel,
}: {
  cancelHref: string;
  formOptions: ProjectFormOptions;
  initialValues: ProjectFormValues;
  isSubmitting: boolean;
  onSubmit: (values: ProjectFormValues) => void | Promise<void>;
  projectManagerLabel?: string | null;
  submitLabel: string;
}) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<ProjectFormValues>({
    defaultValues: initialValues,
    resolver: zodResolver(projectFormSchema),
  });

  useUnsavedChangesPrompt(isDirty && !isSubmitting);

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const organization = useWatch({ control, name: "organization" });
  const building = useWatch({ control, name: "building" });
  const projectManagerValue = useWatch({ control, name: "project_manager" });
  const buildingOptions = useMemo(
    () =>
      buildRecordOptions(
        filterBuildingsByOrganization(formOptions.buildings, organization),
        building,
      ),
    [building, formOptions.buildings, organization],
  );

  useEffect(() => {
    if (!building) {
      return;
    }
    const allowed = formOptions.buildings.some(
      (item) =>
        item.id === building &&
        (!organization || item.organization === organization),
    );
    if (!allowed) {
      setValue("building", "");
    }
  }, [building, formOptions.buildings, organization, setValue]);

  const projectManagerFallback = useMemo(
    () =>
      createUserDirectoryEmailFallback(
        projectManagerValue,
        projectManagerLabel,
      ),
    [projectManagerLabel, projectManagerValue],
  );

  const organizationOptions = buildRecordOptions(
    formOptions.organizations,
    initialValues.organization,
  );

  return (
    <form
      className="space-y-6"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values);
      })}
    >
      <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">
            Basics
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Organization is required. Tenant is derived by the backend and is
            not editable here. Building and project code are optional.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            error={getFieldErrorMessage(errors.organization?.message)}
            id="project-organization"
            label="Organization"
            options={organizationOptions}
            placeholder="Select organization"
            {...register("organization")}
          />
          <SelectField
            error={getFieldErrorMessage(errors.building?.message)}
            id="project-building"
            label="Building"
            options={buildingOptions}
            placeholder="Optional building"
            {...register("building")}
          />
          <TextInputField
            description="Leave blank to auto-generate a project code."
            error={getFieldErrorMessage(errors.project_code?.message)}
            id="project-code"
            inputProps={register("project_code")}
            label="Project code"
          />
          <TextInputField
            error={getFieldErrorMessage(errors.name?.message)}
            id="project-name"
            inputProps={register("name")}
            label="Name"
          />
          <div className="md:col-span-2">
            <TextAreaField
              error={getFieldErrorMessage(errors.description?.message)}
              id="project-description"
              label="Description"
              textAreaProps={register("description")}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">
            Ownership and lifecycle
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Select an optional project manager from the users directory and set
            status and priority.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Controller
            control={control}
            name="project_manager"
            render={({ field }) => (
              <UserDirectoryPicker
                description="Optional project manager for this project."
                disabled={isSubmitting}
                error={getFieldErrorMessage(errors.project_manager?.message)}
                label="Project manager"
                onChange={(value) => field.onChange(value ?? "")}
                organization={organization || null}
                permissionEnabled={
                  !permissionsLoading && hasPermission("users.directory")
                }
                selectedUser={projectManagerFallback}
                value={field.value || null}
              />
            )}
          />
          <SelectField
            error={getFieldErrorMessage(errors.status?.message)}
            id="project-status"
            label="Status"
            options={STATUS_OPTIONS}
            {...register("status")}
          />
          <SelectField
            error={getFieldErrorMessage(errors.priority?.message)}
            id="project-priority"
            label="Priority"
            options={PRIORITY_OPTIONS}
            {...register("priority")}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">
            Schedule
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Planned and actual date ranges must end on or after their start
            dates. Completion percentage is calculated by the backend and is not
            editable.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextInputField
            error={getFieldErrorMessage(errors.planned_start_date?.message)}
            id="project-planned-start"
            inputProps={register("planned_start_date")}
            label="Planned start date"
            type="date"
          />
          <TextInputField
            error={getFieldErrorMessage(errors.planned_end_date?.message)}
            id="project-planned-end"
            inputProps={register("planned_end_date")}
            label="Planned end date"
            type="date"
          />
          <TextInputField
            error={getFieldErrorMessage(errors.actual_start_date?.message)}
            id="project-actual-start"
            inputProps={register("actual_start_date")}
            label="Actual start date"
            type="date"
          />
          <TextInputField
            error={getFieldErrorMessage(errors.actual_end_date?.message)}
            id="project-actual-end"
            inputProps={register("actual_end_date")}
            label="Actual end date"
            type="date"
          />
        </div>
      </section>

      <FormActions
        cancelHref={cancelHref}
        isSubmitting={isSubmitting}
        submitLabel={submitLabel}
      />
    </form>
  );
}

function ProjectProtectedFormState({
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

export function ProjectCreatePageContent() {
  const formOptionsQuery = useProjectFormOptions();
  const defaultValues = useProjectFormDefaults();
  const mutation = useCreateProject();
  const router = useRouter();

  if (formOptionsQuery.isPending) {
    return (
      <ProjectProtectedFormState
        requiredPermissions={["projects.create", "projects.manage"]}
      >
        <AppShell>
          <ProjectFormSkeleton />
        </AppShell>
      </ProjectProtectedFormState>
    );
  }

  if (formOptionsQuery.isError || !formOptionsQuery.data) {
    return (
      <ProjectProtectedFormState
        requiredPermissions={["projects.create", "projects.manage"]}
      >
        <AppShell>
          <ErrorState
            message={formatProjectError(
              formOptionsQuery.error,
              "Project form options could not be loaded.",
            )}
            title="Unable to load project form"
          />
        </AppShell>
      </ProjectProtectedFormState>
    );
  }

  return (
    <ProjectProtectedFormState
      requiredPermissions={["projects.create", "projects.manage"]}
    >
      <ProjectFormLayout
        description="Create a facility project. Tenant is set by the backend from the selected organization."
        errorMessage={
          mutation.isError
            ? formatProjectError(mutation.error, "Project could not be created.")
            : null
        }
        title="New Project"
      >
        <ProjectForm
          cancelHref="/projects"
          formOptions={formOptionsQuery.data}
          initialValues={defaultValues}
          isSubmitting={mutation.isPending}
          onSubmit={async (values) => {
            const project = await mutation.mutateAsync(
              mapProjectFormValuesToCreatePayload(values),
            );
            writeProjectFormFlash("Project created successfully.");
            router.replace(`/projects/${project.id}`);
            router.refresh();
          }}
          submitLabel="Create project"
        />
      </ProjectFormLayout>
    </ProjectProtectedFormState>
  );
}

export function ProjectEditPageContent({ projectId }: { projectId: string }) {
  const detailQuery = useProjectDetail(projectId);
  const formOptionsQuery = useProjectFormOptions();
  const mutation = useUpdateProject(projectId);
  const router = useRouter();
  const defaultValues = useProjectFormDefaults(detailQuery.data);

  if (detailQuery.isPending || formOptionsQuery.isPending) {
    return (
      <ProjectProtectedFormState
        requiredPermissions={["projects.update", "projects.manage"]}
      >
        <AppShell>
          <ProjectFormSkeleton />
        </AppShell>
      </ProjectProtectedFormState>
    );
  }

  if (
    detailQuery.isError ||
    formOptionsQuery.isError ||
    !detailQuery.data ||
    !formOptionsQuery.data
  ) {
    return (
      <ProjectProtectedFormState
        requiredPermissions={["projects.update", "projects.manage"]}
      >
        <AppShell>
          <ErrorState
            message={formatProjectError(
              detailQuery.error ?? formOptionsQuery.error,
              "Project form could not be loaded.",
            )}
            title="Unable to load project form"
          />
        </AppShell>
      </ProjectProtectedFormState>
    );
  }

  return (
    <ProjectProtectedFormState
      requiredPermissions={["projects.update", "projects.manage"]}
    >
      <ProjectFormLayout
        description={`Edit ${detailQuery.data.project_code}. Completion percentage remains read-only.`}
        errorMessage={
          mutation.isError
            ? formatProjectError(mutation.error, "Project could not be updated.")
            : null
        }
        title="Edit Project"
      >
        <ProjectForm
          cancelHref={`/projects/${projectId}`}
          formOptions={formOptionsQuery.data}
          initialValues={defaultValues}
          isSubmitting={mutation.isPending}
          onSubmit={async (values) => {
            const project = await mutation.mutateAsync(
              mapProjectFormValuesToUpdatePayload(values),
            );
            writeProjectFormFlash("Project updated successfully.");
            router.replace(`/projects/${project.id}`);
            router.refresh();
          }}
          projectManagerLabel={detailQuery.data.project_manager_email}
          submitLabel="Save changes"
        />
      </ProjectFormLayout>
    </ProjectProtectedFormState>
  );
}
