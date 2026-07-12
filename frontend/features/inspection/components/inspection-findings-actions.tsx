"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { ErrorState } from "@/components/common/error-state";
import { SelectField } from "@/components/common/select-field";
import { UserDirectoryPicker } from "@/components/common/user-directory-picker";
import { useCreateInspectionCorrectiveAction } from "@/hooks/use-create-inspection-corrective-action";
import { useCreateInspectionFinding } from "@/hooks/use-create-inspection-finding";
import { useDeleteInspectionCorrectiveAction } from "@/hooks/use-delete-inspection-corrective-action";
import { useDeleteInspectionFinding } from "@/hooks/use-delete-inspection-finding";
import { usePermissions } from "@/hooks/use-permissions";
import { useUpdateInspectionCorrectiveAction } from "@/hooks/use-update-inspection-corrective-action";
import { useUpdateInspectionFinding } from "@/hooks/use-update-inspection-finding";
import {
  createEmptyCorrectiveActionFormValues,
  createEmptyFindingFormValues,
  mapCorrectiveActionFormValuesToCreatePayload,
  mapCorrectiveActionFormValuesToUpdatePayload,
  mapCorrectiveActionToFormValues,
  mapFindingFormValuesToCreatePayload,
  mapFindingFormValuesToUpdatePayload,
  mapFindingToFormValues,
} from "@/lib/inspection/findings";
import { createUserDirectoryEmailFallback } from "@/lib/users/directory";
import {
  inspectionCorrectiveActionFormSchema,
  inspectionFindingFormSchema,
} from "@/lib/validations/inspection-findings";
import {
  getFieldErrorMessage,
  TextAreaField,
  TextInputField,
} from "@/features/master-data/components/shared";
import type {
  InspectionCorrectiveAction,
  InspectionCorrectiveActionFormValues,
  InspectionDetail,
  InspectionFinding,
  InspectionFindingFormValues,
} from "@/types/inspection";

type DialogKey =
  | "create-finding"
  | "edit-finding"
  | "delete-finding"
  | "create-corrective-action"
  | "edit-corrective-action"
  | "delete-corrective-action"
  | null;

function formatLabel(value?: string | null, fallback = "Not recorded") {
  if (!value) {
    return fallback;
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not recorded";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function findManagementError(errors: Array<unknown>) {
  return errors.find((error) => Boolean(error)) ?? null;
}

function ManagementSectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

function DialogShell({
  children,
  confirmLabel,
  error,
  isBusy,
  onClose,
  onConfirm,
  title,
}: {
  children: React.ReactNode;
  confirmLabel: string;
  error?: string | null;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div
        aria-labelledby="inspection-management-dialog-title"
        aria-modal="true"
        className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl"
        role="dialog"
      >
        <h3
          className="text-xl font-semibold tracking-tight text-slate-950"
          id="inspection-management-dialog-title"
        >
          {title}
        </h3>
        {error ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            {error}
          </p>
        ) : null}
        <div className="mt-5 space-y-4">{children}</div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
          <button
            className="inline-flex items-center justify-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isBusy}
            onClick={() => void onConfirm()}
            type="button"
          >
            {isBusy ? "Saving..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmationDialog({
  confirmLabel,
  description,
  error,
  isBusy,
  onClose,
  onConfirm,
  title,
}: {
  confirmLabel: string;
  description: string;
  error?: string | null;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
}) {
  return (
    <DialogShell
      confirmLabel={confirmLabel}
      error={error}
      isBusy={isBusy}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
    >
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {description}
      </div>
    </DialogShell>
  );
}

function FindingFormDialog({
  finding,
  inspection,
  isBusy,
  onClose,
  onSubmit,
}: {
  finding?: InspectionFinding | null;
  inspection: InspectionDetail;
  isBusy: boolean;
  onClose: () => void;
  onSubmit: (values: InspectionFindingFormValues) => void | Promise<void>;
}) {
  const itemOptions = useMemo(
    () =>
      inspection.items.map((item) => ({
        value: item.id,
        label: `${item.sequence}. ${item.checklist_item}`,
      })),
    [inspection.items],
  );
  const form = useForm<InspectionFindingFormValues>({
    resolver: zodResolver(inspectionFindingFormSchema),
    defaultValues: finding
      ? mapFindingToFormValues(finding)
      : createEmptyFindingFormValues(inspection.id),
  });

  useEffect(() => {
    form.reset(
      finding
        ? mapFindingToFormValues(finding)
        : createEmptyFindingFormValues(inspection.id),
    );
  }, [finding, form, inspection.id]);

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = form;

  return (
    <DialogShell
      confirmLabel={finding ? "Save finding" : "Create finding"}
      isBusy={isBusy}
      onClose={onClose}
      onConfirm={async () => {
        await handleSubmit(onSubmit)();
      }}
      title={finding ? "Edit Finding" : "Create Finding"}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          error={getFieldErrorMessage(errors.item?.message)}
          id="finding-item"
          label="Checklist item"
          options={itemOptions}
          placeholder="No linked item"
          {...register("item")}
        />
        <SelectField
          error={getFieldErrorMessage(errors.finding_type?.message)}
          id="finding-type"
          label="Finding type"
          options={[
            { value: "non_conformance", label: "Non-Conformance" },
            { value: "observation", label: "Observation" },
            { value: "improvement", label: "Improvement" },
            { value: "hazard", label: "Hazard" },
          ]}
          {...register("finding_type")}
        />
        <SelectField
          error={getFieldErrorMessage(errors.severity?.message)}
          id="finding-severity"
          label="Severity"
          options={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
            { value: "critical", label: "Critical" },
          ]}
          {...register("severity")}
        />
        <SelectField
          error={getFieldErrorMessage(errors.status?.message)}
          id="finding-status"
          label="Status"
          options={[
            { value: "open", label: "Open" },
            { value: "in_progress", label: "In Progress" },
            { value: "resolved", label: "Resolved" },
            { value: "verified", label: "Verified" },
          ]}
          {...register("status")}
        />
      </div>

      <TextAreaField
        error={getFieldErrorMessage(errors.description?.message)}
        id="finding-description"
        label="Description"
        textAreaProps={register("description")}
      />
      <TextAreaField
        error={getFieldErrorMessage(errors.root_cause?.message)}
        id="finding-root-cause"
        label="Root cause"
        textAreaProps={register("root_cause")}
      />
      <TextAreaField
        error={getFieldErrorMessage(errors.recommendation?.message)}
        id="finding-recommendation"
        label="Recommendation"
        textAreaProps={register("recommendation")}
      />
      <TextAreaField
        error={getFieldErrorMessage(errors.ai_recommendation?.message)}
        id="finding-ai-recommendation"
        label="AI recommendation"
        textAreaProps={register("ai_recommendation")}
      />
      <TextInputField
        description="Metadata only. Binary upload remains out of scope."
        error={getFieldErrorMessage(errors.photo_path?.message)}
        id="finding-photo-path"
        label="Photo path"
        inputProps={register("photo_path")}
      />
    </DialogShell>
  );
}

function CorrectiveActionFormDialog({
  action,
  inspection,
  isBusy,
  onClose,
  onSubmit,
  permissionEnabled,
}: {
  action?: InspectionCorrectiveAction | null;
  inspection: InspectionDetail;
  isBusy: boolean;
  onClose: () => void;
  onSubmit: (values: InspectionCorrectiveActionFormValues) => void | Promise<void>;
  permissionEnabled: boolean;
}) {
  const findingOptions = useMemo(
    () =>
      inspection.findings.map((finding) => ({
        value: finding.id,
        label: `${formatLabel(finding.finding_type)} - ${finding.description.slice(0, 80)}`,
      })),
    [inspection.findings],
  );
  const form = useForm<InspectionCorrectiveActionFormValues>({
    resolver: zodResolver(inspectionCorrectiveActionFormSchema),
    defaultValues: action
      ? mapCorrectiveActionToFormValues(action)
      : createEmptyCorrectiveActionFormValues(inspection.id),
  });

  useEffect(() => {
    form.reset(
      action
        ? mapCorrectiveActionToFormValues(action)
        : createEmptyCorrectiveActionFormValues(inspection.id),
    );
  }, [action, form, inspection.id]);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = form;
  const assignedUserFallback = useMemo(
    () =>
      createUserDirectoryEmailFallback(
        action?.assigned_to,
        action?.assigned_to_email,
      ),
    [action?.assigned_to, action?.assigned_to_email],
  );

  return (
    <DialogShell
      confirmLabel={action ? "Save corrective action" : "Create corrective action"}
      isBusy={isBusy}
      onClose={onClose}
      onConfirm={async () => {
        await handleSubmit(onSubmit)();
      }}
      title={action ? "Edit Corrective Action" : "Create Corrective Action"}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          error={getFieldErrorMessage(errors.finding?.message)}
          id="corrective-action-finding"
          label="Finding"
          options={findingOptions}
          placeholder="No linked finding"
          {...register("finding")}
        />
        <Controller
          control={control}
          name="assigned_to"
          render={({ field }) => (
            <UserDirectoryPicker
              description="Optional owner responsible for this corrective action."
              disabled={isBusy}
              error={getFieldErrorMessage(errors.assigned_to?.message)}
              label="Assigned to"
              onChange={(value) => field.onChange(value ?? "")}
              organization={inspection.organization}
              permissionEnabled={permissionEnabled}
              selectedUser={assignedUserFallback}
              tenant={inspection.tenant}
              value={field.value || null}
            />
          )}
        />
        <TextInputField
          error={getFieldErrorMessage(errors.due_date?.message)}
          id="corrective-action-due-date"
          label="Due date"
          type="datetime-local"
          inputProps={register("due_date")}
        />
        <SelectField
          error={getFieldErrorMessage(errors.status?.message)}
          id="corrective-action-status"
          label="Status"
          options={[
            { value: "open", label: "Open" },
            { value: "in_progress", label: "In Progress" },
            { value: "completed", label: "Completed" },
            { value: "verified", label: "Verified" },
            { value: "cancelled", label: "Cancelled" },
            { value: "overdue", label: "Overdue" },
          ]}
          {...register("status")}
        />
        <SelectField
          error={getFieldErrorMessage(errors.verification_status?.message)}
          id="corrective-action-verification-status"
          label="Verification status"
          options={[
            { value: "pending", label: "Pending" },
            { value: "verified", label: "Verified" },
            { value: "rejected", label: "Rejected" },
            { value: "not_required", label: "Not Required" },
          ]}
          {...register("verification_status")}
        />
      </div>
      <TextAreaField
        error={getFieldErrorMessage(errors.notes?.message)}
        id="corrective-action-notes"
        label="Notes"
        textAreaProps={register("notes")}
      />
    </DialogShell>
  );
}

function ManagementRecordList({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="space-y-3">{children}</div>;
}

export function InspectionFindingsActions({
  inspection,
}: {
  inspection: InspectionDetail;
}) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const [activeDialog, setActiveDialog] = useState<DialogKey>(null);
  const [selectedFinding, setSelectedFinding] = useState<InspectionFinding | null>(
    null,
  );
  const [selectedAction, setSelectedAction] =
    useState<InspectionCorrectiveAction | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const createFindingMutation = useCreateInspectionFinding(inspection.id);
  const updateFindingMutation = useUpdateInspectionFinding(
    inspection.id,
    selectedFinding?.id ?? "",
  );
  const deleteFindingMutation = useDeleteInspectionFinding(
    inspection.id,
    selectedFinding?.id ?? "",
  );
  const createCorrectiveActionMutation =
    useCreateInspectionCorrectiveAction(inspection.id);
  const updateCorrectiveActionMutation = useUpdateInspectionCorrectiveAction(
    inspection.id,
    selectedAction?.id ?? "",
  );
  const deleteCorrectiveActionMutation = useDeleteInspectionCorrectiveAction(
    inspection.id,
    selectedAction?.id ?? "",
  );

  const canManage = hasPermission("inspection.manage");
  const canReadDirectory = hasPermission("users.directory");
  const canCreateEditFindings =
    !permissionsLoading &&
    (canManage || hasPermission("inspection.update"));
  const canDeleteFindings =
    !permissionsLoading &&
    (canManage || hasPermission("inspection.delete"));
  const canCreateEditCorrectiveActions =
    !permissionsLoading &&
    (canManage || hasPermission("inspection.manage_corrective_action"));
  const canDeleteCorrectiveActions =
    !permissionsLoading &&
    (canManage || hasPermission("inspection.delete"));

  const managementError = findManagementError([
    createFindingMutation.error,
    updateFindingMutation.error,
    deleteFindingMutation.error,
    createCorrectiveActionMutation.error,
    updateCorrectiveActionMutation.error,
    deleteCorrectiveActionMutation.error,
  ]);

  const isBusy =
    createFindingMutation.isPending ||
    updateFindingMutation.isPending ||
    deleteFindingMutation.isPending ||
    createCorrectiveActionMutation.isPending ||
    updateCorrectiveActionMutation.isPending ||
    deleteCorrectiveActionMutation.isPending;

  if (
    !canCreateEditFindings &&
    !canDeleteFindings &&
    !canCreateEditCorrectiveActions &&
    !canDeleteCorrectiveActions
  ) {
    return null;
  }

  return (
    <>
      {successMessage ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {successMessage}
        </section>
      ) : null}

      {managementError ? (
        <ErrorState
          message={
            managementError instanceof Error
              ? managementError.message
              : "The inspection management action could not be completed."
          }
          title="Management action failed"
        />
      ) : null}

      {canCreateEditFindings || canDeleteFindings ? (
        <ManagementSectionCard
          description="Create, edit, and delete findings using the existing inspection finding APIs. File upload remains out of scope, so photo path is stored as text metadata only."
          title="Findings Management"
        >
          {canCreateEditFindings ? (
            <div className="flex flex-wrap gap-3">
              <button
                className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                onClick={() => {
                  setSuccessMessage(null);
                  setSelectedFinding(null);
                  setActiveDialog("create-finding");
                }}
                type="button"
              >
                Create finding
              </button>
            </div>
          ) : null}

          {inspection.findings.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              No findings exist yet for this inspection.
            </div>
          ) : (
            <ManagementRecordList>
              {inspection.findings.map((finding) => (
                <article
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                  key={finding.id}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 text-sm font-semibold text-slate-950">
                        <span>{formatLabel(finding.finding_type)}</span>
                        <span className="text-slate-400">/</span>
                        <span>{formatLabel(finding.severity)}</span>
                        <span className="text-slate-400">/</span>
                        <span>{formatLabel(finding.status)}</span>
                      </div>
                      <p className="text-sm text-slate-900">{finding.description}</p>
                      <p className="text-xs text-slate-500">
                        Linked item:{" "}
                        {inspection.items.find((item) => item.id === finding.item)
                          ?.checklist_item ?? "Not linked"}
                      </p>
                      <p className="text-xs text-slate-500">
                        Updated {formatDateTime(finding.updated_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canCreateEditFindings ? (
                        <button
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
                          onClick={() => {
                            setSuccessMessage(null);
                            setSelectedFinding(finding);
                            setActiveDialog("edit-finding");
                          }}
                          type="button"
                        >
                          Edit
                        </button>
                      ) : null}
                      {canDeleteFindings ? (
                        <button
                          className="rounded-md border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                          onClick={() => {
                            setSuccessMessage(null);
                            setSelectedFinding(finding);
                            setActiveDialog("delete-finding");
                          }}
                          type="button"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </ManagementRecordList>
          )}
        </ManagementSectionCard>
      ) : null}

      {canCreateEditCorrectiveActions || canDeleteCorrectiveActions ? (
        <ManagementSectionCard
          description="Create, edit, and delete corrective actions using the existing APIs and assignment-safe user directory."
          title="Corrective Actions Management"
        >
          {canCreateEditCorrectiveActions ? (
            <div className="flex flex-wrap gap-3">
              <button
                className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                onClick={() => {
                  setSuccessMessage(null);
                  setSelectedAction(null);
                  setActiveDialog("create-corrective-action");
                }}
                type="button"
              >
                Create corrective action
              </button>
            </div>
          ) : null}

          {inspection.corrective_actions.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              No corrective actions exist yet for this inspection.
            </div>
          ) : (
            <ManagementRecordList>
              {inspection.corrective_actions.map((action) => (
                <article
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                  key={action.id}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 text-sm font-semibold text-slate-950">
                        <span>{formatLabel(action.status)}</span>
                        <span className="text-slate-400">/</span>
                        <span>{formatLabel(action.verification_status)}</span>
                      </div>
                      <p className="text-sm text-slate-900">
                        Finding:{" "}
                        {inspection.findings.find((finding) => finding.id === action.finding)
                          ?.description || "Not linked"}
                      </p>
                      <p className="text-xs text-slate-500">
                        Assigned to: {action.assigned_to_email || "Not assigned"}
                      </p>
                      <p className="text-xs text-slate-500">
                        Due: {formatDateTime(action.due_date)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canCreateEditCorrectiveActions ? (
                        <button
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
                          onClick={() => {
                            setSuccessMessage(null);
                            setSelectedAction(action);
                            setActiveDialog("edit-corrective-action");
                          }}
                          type="button"
                        >
                          Edit
                        </button>
                      ) : null}
                      {canDeleteCorrectiveActions ? (
                        <button
                          className="rounded-md border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                          onClick={() => {
                            setSuccessMessage(null);
                            setSelectedAction(action);
                            setActiveDialog("delete-corrective-action");
                          }}
                          type="button"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </ManagementRecordList>
          )}
        </ManagementSectionCard>
      ) : null}

      {activeDialog === "create-finding" ? (
        <FindingFormDialog
          inspection={inspection}
          isBusy={isBusy}
          onClose={() => setActiveDialog(null)}
          onSubmit={async (values) => {
            await createFindingMutation.mutateAsync(
              mapFindingFormValuesToCreatePayload(values),
            );
            setSuccessMessage("Finding created successfully.");
            setActiveDialog(null);
          }}
        />
      ) : null}

      {activeDialog === "edit-finding" && selectedFinding ? (
        <FindingFormDialog
          finding={selectedFinding}
          inspection={inspection}
          isBusy={isBusy}
          onClose={() => setActiveDialog(null)}
          onSubmit={async (values) => {
            await updateFindingMutation.mutateAsync(
              mapFindingFormValuesToUpdatePayload(values),
            );
            setSuccessMessage("Finding updated successfully.");
            setActiveDialog(null);
          }}
        />
      ) : null}

      {activeDialog === "delete-finding" && selectedFinding ? (
        <DeleteConfirmationDialog
          confirmLabel="Delete finding"
          description={`Delete this finding: "${selectedFinding.description}"? This uses the existing backend delete endpoint.`}
          isBusy={isBusy}
          onClose={() => setActiveDialog(null)}
          onConfirm={async () => {
            await deleteFindingMutation.mutateAsync();
            setSuccessMessage("Finding deleted successfully.");
            setActiveDialog(null);
          }}
          title="Delete Finding"
        />
      ) : null}

      {activeDialog === "create-corrective-action" ? (
        <CorrectiveActionFormDialog
          inspection={inspection}
          isBusy={isBusy}
          onClose={() => setActiveDialog(null)}
          onSubmit={async (values) => {
            await createCorrectiveActionMutation.mutateAsync(
              mapCorrectiveActionFormValuesToCreatePayload(values),
            );
            setSuccessMessage("Corrective action created successfully.");
            setActiveDialog(null);
          }}
          permissionEnabled={!permissionsLoading && canReadDirectory}
        />
      ) : null}

      {activeDialog === "edit-corrective-action" && selectedAction ? (
        <CorrectiveActionFormDialog
          action={selectedAction}
          inspection={inspection}
          isBusy={isBusy}
          onClose={() => setActiveDialog(null)}
          onSubmit={async (values) => {
            await updateCorrectiveActionMutation.mutateAsync(
              mapCorrectiveActionFormValuesToUpdatePayload(values),
            );
            setSuccessMessage("Corrective action updated successfully.");
            setActiveDialog(null);
          }}
          permissionEnabled={!permissionsLoading && canReadDirectory}
        />
      ) : null}

      {activeDialog === "delete-corrective-action" && selectedAction ? (
        <DeleteConfirmationDialog
          confirmLabel="Delete corrective action"
          description={`Delete this corrective action due ${formatDateTime(selectedAction.due_date)}? This uses the existing backend delete endpoint.`}
          isBusy={isBusy}
          onClose={() => setActiveDialog(null)}
          onConfirm={async () => {
            await deleteCorrectiveActionMutation.mutateAsync();
            setSuccessMessage("Corrective action deleted successfully.");
            setActiveDialog(null);
          }}
          title="Delete Corrective Action"
        />
      ) : null}
    </>
  );
}
