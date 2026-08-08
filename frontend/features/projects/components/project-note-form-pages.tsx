"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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
  useCreateProjectNote,
  useDeleteProjectNote,
  useProjectDetail,
  useProjectNoteDetail,
  useProjectNoteFormDefaults,
  useUpdateProjectNote,
} from "@/hooks/use-projects";
import { usePermissions } from "@/hooks/use-permissions";
import { useUnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-prompt";
import {
  formatPersonLabel,
  formatProjectDateTime,
} from "@/lib/projects/display";
import {
  canManageProjectNotes,
  formatProjectNoteCategoryLabel,
  formatProjectNoteError,
} from "@/lib/projects/notes-display";
import {
  mapProjectNoteFormValuesToCreatePayload,
  mapProjectNoteFormValuesToUpdatePayload,
  readProjectNoteFormFlash,
  validateProjectNoteFormValues,
  writeProjectNoteFormFlash,
} from "@/lib/projects/notes-form";
import type { ProjectNoteFormValues } from "@/types/projects";

import { ProjectNoteAttachments } from "./project-note-attachments";

const projectNoteFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required."),
    note: z.string().trim().min(1, "Note is required."),
    category: z.enum([
      "general",
      "meeting",
      "decision",
      "safety",
      "material",
      "contractor",
      "client",
      "other",
    ]),
  })
  .superRefine((values, ctx) => {
    const errors = validateProjectNoteFormValues(values);
    (Object.entries(errors) as Array<[keyof ProjectNoteFormValues, string | undefined]>).forEach(
      ([field, message]) => {
        if (!message) return;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message,
          path: [field],
        });
      },
    );
  });

const CATEGORY_OPTIONS = [
  { value: "general", label: "General" },
  { value: "meeting", label: "Meeting" },
  { value: "decision", label: "Decision" },
  { value: "safety", label: "Safety" },
  { value: "material", label: "Material" },
  { value: "contractor", label: "Contractor" },
  { value: "client", label: "Client" },
  { value: "other", label: "Other" },
];

function NoteBreadcrumbs({
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
            href={`/projects/${projectId}/notes`}
          >
            Notes
          </Link>
        </li>
        <li>/</li>
        <li className="font-medium text-slate-700">{currentLabel}</li>
      </ol>
    </nav>
  );
}

function NoteFormLayout({
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
          eyebrow="Project notes"
          title={title}
        >
          <NoteBreadcrumbs currentLabel={title} projectId={projectId} />
        </PageHeader>
        {errorMessage ? (
          <ErrorState message={errorMessage} title="Unable to save note" />
        ) : null}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {children}
        </section>
      </div>
    </AppShell>
  );
}

function NoteProtectedFormState({ children }: { children: ReactNode }) {
  return (
    <ProtectedPermissionRoute
      mode="any"
      requiredPermissions={["projects.notes.manage", "projects.manage"]}
    >
      {children}
    </ProtectedPermissionRoute>
  );
}

function ProjectNoteForm({
  cancelHref,
  initialValues,
  isSubmitting,
  onSubmit,
  submitLabel,
}: {
  cancelHref: string;
  initialValues: ProjectNoteFormValues;
  isSubmitting: boolean;
  onSubmit: (values: ProjectNoteFormValues) => void | Promise<void>;
  submitLabel: string;
}) {
  const {
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
  } = useForm<ProjectNoteFormValues>({
    defaultValues: initialValues,
    resolver: zodResolver(projectNoteFormSchema),
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
          id="note-title"
          inputProps={register("title")}
          label="Title"
        />
        <SelectField
          error={getFieldErrorMessage(errors.category?.message)}
          id="note-category"
          label="Category"
          options={CATEGORY_OPTIONS}
          {...register("category")}
        />
      </div>
      <TextAreaField
        error={getFieldErrorMessage(errors.note?.message)}
        id="note-body"
        label="Note"
        textAreaProps={register("note")}
      />
      <FormActions
        cancelHref={cancelHref}
        isSubmitting={isSubmitting}
        submitLabel={submitLabel}
      />
    </form>
  );
}

export function ProjectNoteCreatePageContent({
  projectId,
}: {
  projectId: string;
}) {
  const projectQuery = useProjectDetail(projectId);
  const defaultValues = useProjectNoteFormDefaults();
  const mutation = useCreateProjectNote(projectId);
  const router = useRouter();

  if (projectQuery.isPending) {
    return (
      <NoteProtectedFormState>
        <AppShell>
          <LoadingState
            message="Loading project for note creation."
            title="Loading note form"
          />
        </AppShell>
      </NoteProtectedFormState>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <NoteProtectedFormState>
        <AppShell>
          <ErrorState
            message={formatProjectNoteError(
              projectQuery.error,
              "Project could not be loaded for note creation.",
            )}
            title="Unable to load note form"
          />
        </AppShell>
      </NoteProtectedFormState>
    );
  }

  return (
    <NoteProtectedFormState>
      <NoteFormLayout
        description={`Create a note under ${projectQuery.data.project_code}.`}
        errorMessage={
          mutation.isError
            ? formatProjectNoteError(
                mutation.error,
                "Note could not be created.",
              )
            : null
        }
        projectId={projectId}
        title="New Note"
      >
        <ProjectNoteForm
          cancelHref={`/projects/${projectId}/notes`}
          initialValues={defaultValues}
          isSubmitting={mutation.isPending}
          onSubmit={async (values) => {
            const note = await mutation.mutateAsync(
              mapProjectNoteFormValuesToCreatePayload(values),
            );
            writeProjectNoteFormFlash("Note created successfully.");
            router.replace(`/projects/${projectId}/notes/${note.id}`);
            router.refresh();
          }}
          submitLabel="Create note"
        />
      </NoteFormLayout>
    </NoteProtectedFormState>
  );
}

export function ProjectNoteEditPageContent({
  projectId,
  noteId,
}: {
  projectId: string;
  noteId: string;
}) {
  const projectQuery = useProjectDetail(projectId);
  const detailQuery = useProjectNoteDetail(projectId, noteId);
  const mutation = useUpdateProjectNote(projectId, noteId);
  const router = useRouter();
  const defaultValues = useProjectNoteFormDefaults(detailQuery.data);

  if (projectQuery.isPending || detailQuery.isPending) {
    return (
      <NoteProtectedFormState>
        <AppShell>
          <LoadingState
            message="Loading note for editing."
            title="Loading note form"
          />
        </AppShell>
      </NoteProtectedFormState>
    );
  }

  if (
    projectQuery.isError ||
    detailQuery.isError ||
    !projectQuery.data ||
    !detailQuery.data
  ) {
    return (
      <NoteProtectedFormState>
        <AppShell>
          <ErrorState
            message={formatProjectNoteError(
              detailQuery.error ?? projectQuery.error,
              "Note form could not be loaded.",
            )}
            title="Unable to load note form"
          />
        </AppShell>
      </NoteProtectedFormState>
    );
  }

  return (
    <NoteProtectedFormState>
      <NoteFormLayout
        description={`Edit note under ${projectQuery.data.project_code}.`}
        errorMessage={
          mutation.isError
            ? formatProjectNoteError(
                mutation.error,
                "Note could not be updated.",
              )
            : null
        }
        projectId={projectId}
        title="Edit Note"
      >
        <ProjectNoteForm
          cancelHref={`/projects/${projectId}/notes/${noteId}`}
          initialValues={defaultValues}
          isSubmitting={mutation.isPending}
          onSubmit={async (values) => {
            const note = await mutation.mutateAsync(
              mapProjectNoteFormValuesToUpdatePayload(values),
            );
            writeProjectNoteFormFlash("Note updated successfully.");
            router.replace(`/projects/${projectId}/notes/${note.id}`);
            router.refresh();
          }}
          submitLabel="Save changes"
        />
      </NoteFormLayout>
    </NoteProtectedFormState>
  );
}

export function ProjectNoteDetailScreen({
  projectId,
  noteId,
}: {
  projectId: string;
  noteId: string;
}) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const projectQuery = useProjectDetail(projectId);
  const detailQuery = useProjectNoteDetail(projectId, noteId);
  const deleteMutation = useDeleteProjectNote(projectId);
  const router = useRouter();
  const [flash, setFlash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canManage =
    !permissionsLoading && canManageProjectNotes(hasPermission);

  useEffect(() => {
    setFlash(readProjectNoteFormFlash());
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
        title="Unable to load note"
        message={formatProjectNoteError(
          detailQuery.error,
          "Note could not be loaded.",
        )}
      />
    );
  }

  const note = detailQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        description={
          projectQuery.data
            ? `Note on ${projectQuery.data.project_code}`
            : "Project note detail"
        }
        eyebrow="Project notes"
        title={note.title}
      >
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href={`/projects/${projectId}/notes`}
          >
            Back to notes
          </Link>
          {canManage ? (
            <>
              <Link
                className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                href={`/projects/${projectId}/notes/${noteId}/edit`}
              >
                Edit
              </Link>
              <button
                className="inline-flex items-center rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Delete this note? This cannot be undone.",
                    )
                  ) {
                    return;
                  }
                  setErrorMessage(null);
                  void deleteMutation
                    .mutateAsync(noteId)
                    .then(() => {
                      writeProjectNoteFormFlash("Note deleted.");
                      router.replace(`/projects/${projectId}/notes`);
                      router.refresh();
                    })
                    .catch((error) => {
                      setErrorMessage(
                        formatProjectNoteError(
                          error,
                          "Note could not be deleted.",
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
        <ErrorState title="Note action failed" message={errorMessage} />
      ) : null}

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Category
            </dt>
            <dd className="mt-2 text-sm font-medium text-slate-900">
              {formatProjectNoteCategoryLabel(note.category)}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Author
            </dt>
            <dd className="mt-2 text-sm font-medium text-slate-900">
              {formatPersonLabel(
                note.author_email || note.author_name,
                "Unknown",
              )}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Created
            </dt>
            <dd className="mt-2 text-sm font-medium text-slate-900">
              {formatProjectDateTime(note.created_at)}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Updated
            </dt>
            <dd className="mt-2 text-sm font-medium text-slate-900">
              {formatProjectDateTime(note.updated_at)}
            </dd>
          </div>
        </dl>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Note
          </h2>
          {note.note ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
              {note.note}
            </p>
          ) : (
            <div className="mt-2">
              <EmptyState
                title="Empty note"
                message="This note has no body text."
              />
            </div>
          )}
        </div>
      </section>

      <ProjectNoteAttachments noteId={noteId} />
    </div>
  );
}
