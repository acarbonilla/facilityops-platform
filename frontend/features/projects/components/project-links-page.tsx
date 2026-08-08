"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState, type FormEvent } from "react";

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
  useCreateProjectLink,
  useDeleteProjectLink,
  useProjectDetail,
  useProjectLinkList,
  useProjectLinkOptions,
  useProjectTaskList,
  useUpdateProjectLink,
} from "@/hooks/use-projects";
import { usePermissions } from "@/hooks/use-permissions";
import { formatProjectDateTime } from "@/lib/projects/display";
import {
  DEFAULT_PROJECT_LINK_LIST_FILTERS,
  PROJECT_LINK_RELATIONSHIPS,
  PROJECT_LINK_TYPES,
  buildProjectLinkFormDefaults,
  canManageProjectLinks,
  filterProjectLinks,
  formatProjectLinkAccessibilityLabel,
  formatProjectLinkError,
  formatProjectLinkRelationshipLabel,
  formatProjectLinkTargetLabel,
  formatProjectLinkTypeLabel,
  getProjectLinkListLayoutClasses,
  getProjectLinkTargetHref,
  mapProjectLinkEditFormValuesToUpdatePayload,
  mapProjectLinkFormValuesToCreatePayload,
  mapProjectLinkToEditFormValues,
  serializeProjectLinkListParams,
  summarizeProjectLinksByType,
  validateProjectLinkFormValues,
} from "@/lib/projects/links";
import type {
  ProjectOperationalLink,
  ProjectOperationalLinkEditFormValues,
  ProjectOperationalLinkFormValues,
  ProjectOperationalLinkListFilters,
  ProjectOperationalLinkType,
} from "@/types/projects";

const LINK_TYPE_FILTER_OPTIONS: SelectOption[] = [
  { value: "", label: "All types" },
  ...PROJECT_LINK_TYPES.map((type) => ({
    value: type,
    label: formatProjectLinkTypeLabel(type),
  })),
];

const RELATIONSHIP_FILTER_OPTIONS: SelectOption[] = [
  { value: "", label: "All relationships" },
  ...PROJECT_LINK_RELATIONSHIPS.map((relationship) => ({
    value: relationship,
    label: formatProjectLinkRelationshipLabel(relationship),
  })),
];

const ACCESSIBILITY_FILTER_OPTIONS: SelectOption[] = [
  { value: "", label: "All access states" },
  { value: "accessible", label: "Accessible" },
  { value: "restricted", label: "Restricted" },
];

const RELATIONSHIP_OPTIONS: SelectOption[] = PROJECT_LINK_RELATIONSHIPS.map(
  (relationship) => ({
    value: relationship,
    label: formatProjectLinkRelationshipLabel(relationship),
  }),
);

const LINK_TYPE_OPTIONS: SelectOption[] = PROJECT_LINK_TYPES.map((type) => ({
  value: type,
  label: formatProjectLinkTypeLabel(type),
}));

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function LinkMobileCard({
  link,
  canManage,
  isEditing,
  editValues,
  onStartEdit,
  onCancelEdit,
  onChangeEdit,
  onSaveEdit,
  onRemove,
  isSaving,
  isRemoving,
}: {
  link: ProjectOperationalLink;
  canManage: boolean;
  isEditing: boolean;
  editValues: ProjectOperationalLinkEditFormValues | null;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChangeEdit: (values: ProjectOperationalLinkEditFormValues) => void;
  onSaveEdit: () => void;
  onRemove: () => void;
  isSaving: boolean;
  isRemoving: boolean;
}) {
  const href = getProjectLinkTargetHref(link);
  const accessLabel = formatProjectLinkAccessibilityLabel(
    link.target_accessible,
  );

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {formatProjectLinkTypeLabel(link.link_type)}
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-950">
            {href ? (
              <Link className="text-blue-800 hover:underline" href={href}>
                {formatProjectLinkTargetLabel(link)}
              </Link>
            ) : (
              formatProjectLinkTargetLabel(link)
            )}
          </h3>
        </div>
        <span
          aria-label={`Access: ${accessLabel}`}
          className={
            link.target_accessible
              ? "rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700"
              : "rounded-full border border-amber-400 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900"
          }
        >
          {accessLabel}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Relationship
          </dt>
          <dd className="mt-1 text-slate-800">
            {formatProjectLinkRelationshipLabel(link.relationship)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Status
          </dt>
          <dd className="mt-1 text-slate-800">
            {link.target_accessible
              ? link.target_status || "Unknown"
              : "Unavailable"}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Notes
          </dt>
          <dd className="mt-1 text-slate-800">
            {link.notes?.trim() || "No notes"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Linked
          </dt>
          <dd className="mt-1 text-slate-800">
            {formatProjectDateTime(link.created_at)}
          </dd>
        </div>
      </dl>
      {canManage && isEditing && editValues ? (
        <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <SelectField
            label="Relationship"
            name={`edit-relationship-${link.id}`}
            onChange={(event) =>
              onChangeEdit({
                ...editValues,
                relationship: event.target
                  .value as ProjectOperationalLinkEditFormValues["relationship"],
              })
            }
            options={RELATIONSHIP_OPTIONS}
            value={editValues.relationship}
          />
          <FormField htmlFor={`edit-notes-${link.id}`} label="Notes">
            <textarea
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              id={`edit-notes-${link.id}`}
              onChange={(event) =>
                onChangeEdit({ ...editValues, notes: event.target.value })
              }
              rows={3}
              value={editValues.notes}
            />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              disabled={isSaving}
              onClick={onSaveEdit}
              type="button"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
            <button
              className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={onCancelEdit}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {canManage && !isEditing ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onStartEdit}
            type="button"
          >
            Edit
          </button>
          <button
            className="inline-flex items-center rounded-md border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
            disabled={isRemoving}
            onClick={onRemove}
            type="button"
          >
            Remove
          </button>
        </div>
      ) : null}
    </article>
  );
}

export function ProjectLinksPageScreen({ projectId }: { projectId: string }) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const projectQuery = useProjectDetail(projectId);
  const createMutation = useCreateProjectLink(projectId);
  const updateMutation = useUpdateProjectLink(projectId);
  const deleteMutation = useDeleteProjectLink(projectId);
  const tasksQuery = useProjectTaskList(projectId, {
    page_size: 100,
    ordering: "sequence",
  });

  const [filters, setFilters] = useState<ProjectOperationalLinkListFilters>(
    DEFAULT_PROJECT_LINK_LIST_FILTERS,
  );
  const [page, setPage] = useState(1);
  const [flash, setFlash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<ProjectOperationalLinkFormValues>(
    buildProjectLinkFormDefaults(),
  );
  const [formErrors, setFormErrors] = useState<{
    link_type?: string;
    target_id?: string;
  }>({});
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editValues, setEditValues] =
    useState<ProjectOperationalLinkEditFormValues | null>(null);
  const [optionSearch, setOptionSearch] = useState("");

  const deferredSearch = useDeferredValue(filters.search.trim());
  const deferredOptionSearch = useDeferredValue(optionSearch.trim());
  const listParams = serializeProjectLinkListParams(
    { ...filters, pageSize: 100 },
    1,
  );
  const listQuery = useProjectLinkList(projectId, listParams);
  const linkOptionsQuery = useProjectLinkOptions(
    projectId,
    formValues.link_type
      ? {
          type: formValues.link_type as ProjectOperationalLinkType,
          search: deferredOptionSearch || undefined,
          page_size: 50,
        }
      : null,
  );

  const layout = getProjectLinkListLayoutClasses();
  const canManage =
    !permissionsLoading && canManageProjectLinks(hasPermission);

  const allLinks = useMemo(
    () => listQuery.data?.results ?? [],
    [listQuery.data?.results],
  );
  const filteredLinks = useMemo(
    () => filterProjectLinks(allLinks, filters, deferredSearch),
    [allLinks, filters, deferredSearch],
  );
  const totalCount = filteredLinks.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * filters.pageSize;
  const pageLinks = filteredLinks.slice(
    pageStart,
    pageStart + filters.pageSize,
  );
  const typeSummary = summarizeProjectLinksByType(allLinks);

  const taskOptions: SelectOption[] = useMemo(
    () => [
      { value: "", label: "No task (project-level)" },
      ...(tasksQuery.data?.results ?? []).map((task) => ({
        value: task.id,
        label: `${task.task_code} — ${task.name}`,
      })),
    ],
    [tasksQuery.data?.results],
  );

  const optionSelectOptions: SelectOption[] = useMemo(
    () =>
      (linkOptionsQuery.data?.results ?? []).map((option) => ({
        value: option.id,
        label: `${option.number || "No number"} — ${option.title} (${option.status})`,
      })),
    [linkOptionsQuery.data?.results],
  );

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setActionError(null);
    const errors = validateProjectLinkFormValues(formValues);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      await createMutation.mutateAsync(
        mapProjectLinkFormValuesToCreatePayload(formValues),
      );
      setFormValues(buildProjectLinkFormDefaults());
      setOptionSearch("");
      setFlash("Operational link created.");
    } catch (error) {
      setActionError(
        formatProjectLinkError(error, "Link could not be created."),
      );
    }
  }

  async function handleSaveEdit(linkId: string) {
    if (!editValues) {
      return;
    }
    setActionError(null);
    try {
      await updateMutation.mutateAsync({
        linkId,
        payload: mapProjectLinkEditFormValuesToUpdatePayload(editValues),
      });
      setEditingLinkId(null);
      setEditValues(null);
      setFlash("Link updated.");
    } catch (error) {
      setActionError(
        formatProjectLinkError(error, "Link could not be updated."),
      );
    }
  }

  async function handleRemove(link: ProjectOperationalLink) {
    const label = formatProjectLinkTargetLabel(link);
    if (
      !window.confirm(
        `Remove link to ${label}? This soft-deletes the operational link.`,
      )
    ) {
      return;
    }
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(link.id);
      if (editingLinkId === link.id) {
        setEditingLinkId(null);
        setEditValues(null);
      }
      setFlash("Link removed.");
    } catch (error) {
      setActionError(
        formatProjectLinkError(error, "Link could not be removed."),
      );
    }
  }

  const columns: DataTableColumn<ProjectOperationalLink>[] = [
    {
      header: "Type",
      cell: (link) => formatProjectLinkTypeLabel(link.link_type),
    },
    {
      header: "Target",
      cell: (link) => {
        const href = getProjectLinkTargetHref(link);
        const label = formatProjectLinkTargetLabel(link);
        if (href) {
          return (
            <Link className="font-medium text-blue-800 hover:underline" href={href}>
              {label}
            </Link>
          );
        }
        return <span className="font-medium text-slate-900">{label}</span>;
      },
      className: "min-w-56 whitespace-normal",
    },
    {
      header: "Access",
      cell: (link) => (
        <span
          aria-label={`Access: ${formatProjectLinkAccessibilityLabel(link.target_accessible)}`}
          className={
            link.target_accessible
              ? "rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700"
              : "rounded-full border border-amber-400 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900"
          }
        >
          {formatProjectLinkAccessibilityLabel(link.target_accessible)}
        </span>
      ),
    },
    {
      header: "Relationship",
      cell: (link) => formatProjectLinkRelationshipLabel(link.relationship),
    },
    {
      header: "Notes",
      cell: (link) => link.notes?.trim() || "—",
      className: "min-w-40 whitespace-normal",
    },
    {
      header: "Linked",
      cell: (link) => formatProjectDateTime(link.created_at),
    },
    {
      header: "Actions",
      cell: (link) =>
        canManage ? (
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setEditingLinkId(link.id);
                setEditValues(mapProjectLinkToEditFormValues(link));
              }}
              type="button"
            >
              Edit
            </button>
            <button
              className="inline-flex items-center rounded-md border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
              disabled={deleteMutation.isPending}
              onClick={() => void handleRemove(link)}
              type="button"
            >
              Remove
            </button>
          </div>
        ) : (
          "—"
        ),
    },
  ];

  const projectName = projectQuery.data?.name ?? "Project";

  return (
    <div className="space-y-6">
      <PageHeader
        description={`Linked operational records for ${projectName}. Links are project-owned and do not change FM, maintenance, or inspection workflows.`}
        eyebrow="Project links"
        title="Linked Records"
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
            href={`/projects/${projectId}/tasks`}
          >
            Tasks
          </Link>
        </div>
      </PageHeader>

      {flash ? (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
          role="status"
        >
          {flash}
        </div>
      ) : null}
      {actionError ? (
        <ErrorState title="Unable to update links" message={actionError} />
      ) : null}

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            Summary by type
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Counts from all active operational links on this project.
          </p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-3">
          {typeSummary.map((row) => (
            <div
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              key={row.type}
            >
              <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                {row.label}
              </dt>
              <dd className="mt-2 text-2xl font-semibold text-slate-950">
                {row.count.toLocaleString()}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {canManage ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">
              Add link
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose a record type, search accessible targets, set the
              relationship, and optionally attach a project task.
            </p>
          </div>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
            <SelectField
              error={formErrors.link_type}
              label="Link type"
              name="link_type"
              onChange={(event) => {
                setFormValues((current) => ({
                  ...current,
                  link_type: event.target
                    .value as ProjectOperationalLinkFormValues["link_type"],
                  target_id: "",
                }));
                setOptionSearch("");
              }}
              options={LINK_TYPE_OPTIONS}
              placeholder="Select type"
              required
              value={formValues.link_type}
            />
            <SelectField
              label="Relationship"
              name="relationship"
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  relationship: event.target
                    .value as ProjectOperationalLinkFormValues["relationship"],
                }))
              }
              options={RELATIONSHIP_OPTIONS}
              value={formValues.relationship}
            />
            <FormField
              description="Search by number or title. Results exclude already-linked records."
              htmlFor="link-option-search"
              label="Search records"
            >
              <input
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                disabled={!formValues.link_type}
                id="link-option-search"
                onChange={(event) => setOptionSearch(event.target.value)}
                placeholder="Search by number or title"
                type="search"
                value={optionSearch}
              />
            </FormField>
            <SelectField
              description={
                linkOptionsQuery.isError
                  ? formatProjectLinkError(
                      linkOptionsQuery.error,
                      "Unable to load link options.",
                    )
                  : undefined
              }
              error={formErrors.target_id}
              label="Target record"
              name="target_id"
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  target_id: event.target.value,
                }))
              }
              options={optionSelectOptions}
              placeholder={
                !formValues.link_type
                  ? "Select a link type first"
                  : linkOptionsQuery.isPending
                    ? "Loading options…"
                    : "Select a record"
              }
              required
              value={formValues.target_id}
            />
            <SelectField
              label="Project task (optional)"
              name="project_task"
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  project_task: event.target.value,
                }))
              }
              options={taskOptions}
              value={formValues.project_task}
            />
            <FormField htmlFor="link-notes" label="Notes (optional)">
              <textarea
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                id="link-notes"
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                rows={3}
                value={formValues.notes}
              />
            </FormField>
            <div className="md:col-span-2">
              <button
                className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                disabled={createMutation.isPending}
                type="submit"
              >
                {createMutation.isPending ? "Adding…" : "Add link"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            Linked records
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Filter by type, relationship, access state, or free-text search.
            Restricted targets hide private details when you lack module access.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <FormField htmlFor="link-filter-search" label="Search">
            <input
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              id="link-filter-search"
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }));
              }}
              placeholder="Search targets or notes"
              type="search"
              value={filters.search}
            />
          </FormField>
          <SelectField
            label="Type"
            name="filter_link_type"
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({
                ...current,
                linkType: event.target
                  .value as ProjectOperationalLinkListFilters["linkType"],
              }));
            }}
            options={LINK_TYPE_FILTER_OPTIONS}
            value={filters.linkType}
          />
          <SelectField
            label="Relationship"
            name="filter_relationship"
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({
                ...current,
                relationship: event.target
                  .value as ProjectOperationalLinkListFilters["relationship"],
              }));
            }}
            options={RELATIONSHIP_FILTER_OPTIONS}
            value={filters.relationship}
          />
          <SelectField
            label="Access"
            name="filter_accessibility"
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({
                ...current,
                accessibility: event.target
                  .value as ProjectOperationalLinkListFilters["accessibility"],
              }));
            }}
            options={ACCESSIBILITY_FILTER_OPTIONS}
            value={filters.accessibility}
          />
          <SelectField
            label="Page size"
            name="filter_page_size"
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({
                ...current,
                pageSize: Number(event.target.value),
              }));
            }}
            options={PAGE_SIZE_OPTIONS.map((size) => ({
              value: String(size),
              label: String(size),
            }))}
            value={String(filters.pageSize)}
          />
        </div>

        {listQuery.isPending ? (
          <div
            aria-label="Loading linked records"
            className="h-40 animate-pulse rounded-lg border border-slate-200 bg-slate-100"
            role="status"
          />
        ) : null}

        {listQuery.isError ? (
          <ErrorState
            action={
              <button
                className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
                onClick={() => void listQuery.refetch()}
                type="button"
              >
                Retry
              </button>
            }
            message={formatProjectLinkError(
              listQuery.error,
              "Linked records could not be loaded.",
            )}
            title="Unable to load linked records"
          />
        ) : null}

        {!listQuery.isPending && !listQuery.isError && pageLinks.length === 0 ? (
          <EmptyState
            message="No operational links match the current filters."
            title="No linked records"
          />
        ) : null}

        {!listQuery.isPending && !listQuery.isError && pageLinks.length > 0 ? (
          <>
            <div className={layout.tableWrapper}>
              <DataTable
                caption="Project operational links"
                columns={columns}
                getRowKey={(link) => link.id}
                rows={pageLinks}
              />
            </div>
            <div className={layout.cardsWrapper}>
              {pageLinks.map((link) => (
                <LinkMobileCard
                  canManage={canManage}
                  editValues={
                    editingLinkId === link.id ? editValues : null
                  }
                  isEditing={editingLinkId === link.id}
                  isRemoving={deleteMutation.isPending}
                  isSaving={updateMutation.isPending}
                  key={link.id}
                  link={link}
                  onCancelEdit={() => {
                    setEditingLinkId(null);
                    setEditValues(null);
                  }}
                  onChangeEdit={setEditValues}
                  onRemove={() => void handleRemove(link)}
                  onSaveEdit={() => void handleSaveEdit(link.id)}
                  onStartEdit={() => {
                    setEditingLinkId(link.id);
                    setEditValues(mapProjectLinkToEditFormValues(link));
                  }}
                />
              ))}
            </div>

            {editingLinkId && editValues && layout.tableWrapper ? (
              <div className="hidden space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:block">
                <h3 className="text-sm font-semibold text-slate-900">
                  Edit link
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField
                    label="Relationship"
                    name="desktop-edit-relationship"
                    onChange={(event) =>
                      setEditValues({
                        ...editValues,
                        relationship: event.target
                          .value as ProjectOperationalLinkEditFormValues["relationship"],
                      })
                    }
                    options={RELATIONSHIP_OPTIONS}
                    value={editValues.relationship}
                  />
                  <SelectField
                    label="Project task (optional)"
                    name="desktop-edit-task"
                    onChange={(event) =>
                      setEditValues({
                        ...editValues,
                        project_task: event.target.value,
                      })
                    }
                    options={taskOptions}
                    value={editValues.project_task}
                  />
                  <FormField
                    htmlFor="desktop-edit-notes"
                    label="Notes"
                  >
                    <textarea
                      className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                      id="desktop-edit-notes"
                      onChange={(event) =>
                        setEditValues({
                          ...editValues,
                          notes: event.target.value,
                        })
                      }
                      rows={3}
                      value={editValues.notes}
                    />
                  </FormField>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                    disabled={updateMutation.isPending}
                    onClick={() => void handleSaveEdit(editingLinkId)}
                    type="button"
                  >
                    {updateMutation.isPending ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setEditingLinkId(null);
                      setEditValues(null);
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <p>
                Showing {pageLinks.length} of {totalCount} link
                {totalCount === 1 ? "" : "s"}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  disabled={safePage <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  type="button"
                >
                  Previous
                </button>
                <span className="inline-flex items-center px-2">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  disabled={safePage >= totalPages}
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
        ) : null}
      </section>
    </div>
  );
}
