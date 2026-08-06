"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { FormField } from "@/components/common/form-field";
import { PageHeader } from "@/components/common/page-header";
import {
  SelectField,
  type SelectOption,
} from "@/components/common/select-field";
import {
  useDeleteProjectNote,
  useProjectDetail,
  useProjectNoteList,
} from "@/hooks/use-projects";
import { usePermissions } from "@/hooks/use-permissions";
import {
  formatPersonLabel,
  formatProjectDateTime,
} from "@/lib/projects/display";
import {
  canManageProjectNotes,
  formatProjectNoteCategoryLabel,
  formatProjectNoteError,
  getProjectNoteListLayoutClasses,
} from "@/lib/projects/notes-display";
import {
  DEFAULT_PROJECT_NOTE_LIST_FILTERS,
  serializeProjectNoteListParams,
} from "@/lib/projects/notes-filters";
import { readProjectNoteFormFlash } from "@/lib/projects/notes-form";
import type {
  ProjectNote,
  ProjectNoteListFilters,
} from "@/types/projects";

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: "general", label: "General" },
  { value: "meeting", label: "Meeting" },
  { value: "decision", label: "Decision" },
  { value: "safety", label: "Safety" },
  { value: "material", label: "Material" },
  { value: "contractor", label: "Contractor" },
  { value: "client", label: "Client" },
  { value: "other", label: "Other" },
];

const SORT_OPTIONS: SelectOption[] = [
  { value: "-created_at", label: "Newest first" },
  { value: "created_at", label: "Oldest first" },
  { value: "title", label: "Title: A to Z" },
  { value: "-title", label: "Title: Z to A" },
  { value: "category", label: "Category" },
  { value: "-category", label: "Category: reverse" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function NoteMobileCard({
  projectId,
  note,
  canManage,
  onDelete,
  isDeleting,
}: {
  projectId: string;
  note: ProjectNote;
  canManage: boolean;
  onDelete: (noteId: string) => void;
  isDeleting: boolean;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {formatProjectNoteCategoryLabel(note.category)}
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-950">
            {note.title}
          </h3>
        </div>
      </div>
      <p className="mt-3 line-clamp-3 text-sm text-slate-700">{note.note}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Author
          </dt>
          <dd className="mt-1 text-slate-800">
            {formatPersonLabel(
              note.author_email || note.author_name,
              "Unknown",
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Created
          </dt>
          <dd className="mt-1 text-slate-800">
            {formatProjectDateTime(note.created_at)}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          href={`/projects/${projectId}/notes/${note.id}`}
        >
          View
        </Link>
        {canManage ? (
          <>
            <Link
              className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              href={`/projects/${projectId}/notes/${note.id}/edit`}
            >
              Edit
            </Link>
            <button
              className="inline-flex items-center rounded-md border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
              disabled={isDeleting}
              onClick={() => onDelete(note.id)}
              type="button"
            >
              Delete
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

export function ProjectNotesListScreen({ projectId }: { projectId: string }) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const projectQuery = useProjectDetail(projectId);
  const deleteMutation = useDeleteProjectNote(projectId);
  const [filters, setFilters] = useState<ProjectNoteListFilters>(
    DEFAULT_PROJECT_NOTE_LIST_FILTERS,
  );
  const [page, setPage] = useState(1);
  const [flash, setFlash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(filters.search.trim());
  const listParams = serializeProjectNoteListParams(
    filters,
    page,
    deferredSearch,
  );
  const listQuery = useProjectNoteList(projectId, listParams);
  const layout = getProjectNoteListLayoutClasses();
  const canManage =
    !permissionsLoading && canManageProjectNotes(hasPermission);

  useEffect(() => {
    setFlash(readProjectNoteFormFlash());
  }, []);

  async function handleDelete(noteId: string) {
    if (!window.confirm("Delete this note? This cannot be undone.")) {
      return;
    }
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(noteId);
      setFlash("Note deleted.");
    } catch (error) {
      setActionError(
        formatProjectNoteError(error, "Note could not be deleted."),
      );
    }
  }

  const columns: DataTableColumn<ProjectNote>[] = [
    {
      header: "Title",
      cell: (note) => (
        <span className="font-medium text-slate-900">{note.title}</span>
      ),
      className: "min-w-48 whitespace-normal",
    },
    {
      header: "Category",
      cell: (note) => formatProjectNoteCategoryLabel(note.category),
    },
    {
      header: "Author",
      cell: (note) =>
        formatPersonLabel(note.author_email || note.author_name, "Unknown"),
      className: "min-w-40 whitespace-normal",
    },
    {
      header: "Created",
      cell: (note) => formatProjectDateTime(note.created_at),
    },
    {
      header: "Actions",
      cell: (note) => (
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href={`/projects/${projectId}/notes/${note.id}`}
          >
            View
          </Link>
          {canManage ? (
            <Link
              className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              href={`/projects/${projectId}/notes/${note.id}/edit`}
            >
              Edit
            </Link>
          ) : null}
        </div>
      ),
    },
  ];

  const projectName = projectQuery.data?.name ?? "Project";
  const notes = listQuery.data?.results ?? [];
  const totalCount = listQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        description={`Notes for ${projectName}. Capture meetings, decisions, and coordination details.`}
        eyebrow="Project notes"
        title="Notes"
      >
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href={`/projects/${projectId}`}
          >
            Back to project
          </Link>
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href={`/projects/${projectId}/timeline`}
          >
            Timeline
          </Link>
          {canManage ? (
            <Link
              className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              href={`/projects/${projectId}/notes/new`}
            >
              New note
            </Link>
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
      {actionError ? (
        <ErrorState title="Note action failed" message={actionError} />
      ) : null}

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField label="Search" htmlFor="note-search">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              id="note-search"
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }));
              }}
              placeholder="Title or note text…"
              value={filters.search}
            />
          </FormField>
          <SelectField
            id="note-category"
            label="Category"
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({
                ...current,
                category: event.target
                  .value as ProjectNoteListFilters["category"],
              }));
            }}
            options={CATEGORY_OPTIONS}
            placeholder="All categories"
            value={filters.category}
          />
          <SelectField
            id="note-sort"
            label="Sort"
            onChange={(event) => {
              setFilters((current) => ({
                ...current,
                sort: event.target.value,
              }));
            }}
            options={SORT_OPTIONS}
            value={filters.sort}
          />
          <SelectField
            id="note-page-size"
            label="Page size"
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({
                ...current,
                pageSize: Number(event.target.value) || 20,
              }));
            }}
            options={PAGE_SIZE_OPTIONS.map((size) => ({
              value: String(size),
              label: String(size),
            }))}
            value={String(filters.pageSize)}
          />
        </div>
      </section>

      {listQuery.isError ? (
        <ErrorState
          title="Unable to load notes"
          message={formatProjectNoteError(
            listQuery.error,
            "Note list could not be loaded.",
          )}
          action={
            <button
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              onClick={() => void listQuery.refetch()}
              type="button"
            >
              Retry
            </button>
          }
        />
      ) : null}

      {listQuery.isPending ? (
        <div
          className="h-48 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
          role="status"
        />
      ) : notes.length === 0 ? (
        <EmptyState
          title="No notes found"
          message="Create a note or adjust filters to see project collaboration notes."
          action={
            canManage ? (
              <Link
                className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                href={`/projects/${projectId}/notes/new`}
              >
                Create note
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className={layout.tableWrapper}>
            <DataTable
              columns={columns}
              getRowKey={(note) => note.id}
              rows={notes}
            />
          </div>
          <div className={layout.cardsWrapper}>
            {notes.map((note) => (
              <NoteMobileCard
                canManage={canManage}
                isDeleting={deleteMutation.isPending}
                key={note.id}
                note={note}
                onDelete={(id) => {
                  void handleDelete(id);
                }}
                projectId={projectId}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Showing {notes.length} of {totalCount} notes
            </p>
            <div className="flex gap-2">
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                Previous
              </button>
              <span className="px-2 py-2 text-sm text-slate-700">
                Page {page} of {totalPages}
              </span>
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
