"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
} from "react-hook-form";

import { ErrorState } from "@/components/common/error-state";
import { FormField } from "@/components/common/form-field";
import { LoadingState } from "@/components/common/loading-state";
import { SelectField } from "@/components/common/select-field";
import { SwitchField } from "@/components/common/switch-field";
import { useUnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-prompt";
import { maintenanceWorkOrderSchema } from "@/lib/validations/maintenance";
import {
  createEmptyMaintenanceLabor,
  createEmptyMaintenanceMaterial,
  createEmptyMaintenanceTask,
  getMaintenanceCapabilityNotes,
  sanitizeMaintenanceFormValues,
} from "@/lib/maintenance/form";
import {
  buildRecordOptions,
  filterBuildingsByOrganization,
  filterBuildingsByTenant,
  filterFloorsByBuilding,
  filterOrganizationsByTenant,
  getFieldErrorMessage,
  TextAreaField,
  TextInputField,
} from "@/features/master-data/components/shared";
import type {
  Area,
  Asset,
  Department,
} from "@/types/master-data";
import type {
  MaintenanceFormOptions,
  MaintenanceMaterialFormValues,
  MaintenanceTaskFormValues,
  MaintenanceWorkOrderFormValues,
  MaintenanceWorkOrderStatus,
} from "@/types/maintenance";

import { MaintenanceStatusBadge } from "./maintenance-status-badge";

function filterDepartments(
  departments: Department[],
  tenantId: string,
  organizationId: string,
) {
  return departments.filter((department) => {
    if (organizationId) {
      return department.organization === organizationId;
    }

    if (tenantId) {
      return department.tenant === tenantId;
    }

    return true;
  });
}

function filterAreas(areas: Area[], buildingId: string, floorId: string) {
  return areas.filter((area) => {
    if (floorId) {
      return area.floor === floorId;
    }

    if (buildingId) {
      return area.building === buildingId;
    }

    return true;
  });
}

function filterAssets(
  assets: Asset[],
  organizationId: string,
  buildingId: string,
  floorId: string,
  areaId: string,
) {
  return assets.filter((asset) => {
    if (organizationId && asset.organization !== organizationId) {
      return false;
    }

    if (buildingId && asset.building !== buildingId) {
      return false;
    }

    if (floorId && asset.floor !== floorId) {
      return false;
    }

    if (areaId && asset.area !== areaId) {
      return false;
    }

    return true;
  });
}

function MaintenanceFormSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SectionNotice({
  tone = "slate",
  children,
}: {
  tone?: "amber" | "slate";
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        tone === "amber"
          ? "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          : "rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
      }
    >
      {children}
    </div>
  );
}

function MaintenanceSectionHeaderAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function TextFieldGrid({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function getTaskError(
  errors: FieldErrors<MaintenanceWorkOrderFormValues>,
  index: number,
  key: keyof MaintenanceTaskFormValues,
) {
  return getFieldErrorMessage(errors.tasks?.[index]?.[key]?.message as string | undefined);
}

function getMaterialError(
  errors: FieldErrors<MaintenanceWorkOrderFormValues>,
  index: number,
  key: keyof MaintenanceMaterialFormValues,
) {
  return getFieldErrorMessage(
    errors.materials?.[index]?.[key]?.message as string | undefined,
  );
}

function getLaborError(
  errors: FieldErrors<MaintenanceWorkOrderFormValues>,
  index: number,
  key: "estimated_hours" | "rate" | "notes",
) {
  return getFieldErrorMessage(errors.labor?.[index]?.[key]?.message as string | undefined);
}

export function MaintenanceBasicInfoSection({
  currentStatus,
  errors,
  register,
}: {
  currentStatus?: MaintenanceWorkOrderStatus;
  errors: FieldErrors<MaintenanceWorkOrderFormValues>;
  register: ReturnType<typeof useForm<MaintenanceWorkOrderFormValues>>["register"];
}) {
  return (
    <MaintenanceFormSection
      description="Persisted work-order fields plus clearly marked planning-only fields that the current backend foundation does not save yet."
      title="Basic Information"
    >
      <TextFieldGrid>
        <TextInputField
          description="Short title used across maintenance list and detail views."
          error={getFieldErrorMessage(errors.title?.message)}
          id="maintenance-title"
          inputProps={register("title")}
          label="Title"
        />
        <TextInputField
          description="The authenticated session owns requester assignment in the current backend."
          disabled
          error={getFieldErrorMessage(errors.requested_by?.message)}
          id="maintenance-requested-by"
          inputProps={register("requested_by")}
          label="Requested by"
        />
        <SelectField
          description="Planning category for the work order. This is not persisted by the current API yet."
          error={getFieldErrorMessage(errors.category?.message)}
          id="maintenance-category"
          label="Maintenance category"
          options={[
            { value: "preventive", label: "Preventive" },
            { value: "corrective", label: "Corrective" },
            { value: "emergency", label: "Emergency" },
            { value: "inspection", label: "Inspection" },
            { value: "installation", label: "Installation" },
            { value: "other", label: "Other" },
          ]}
          {...register("category")}
        />
        <SelectField
          description="Planning type for the work order. This is not persisted by the current API yet."
          error={getFieldErrorMessage(errors.maintenance_type?.message)}
          id="maintenance-type"
          label="Maintenance type"
          options={[
            { value: "planned", label: "Planned" },
            { value: "reactive", label: "Reactive" },
            { value: "preventive", label: "Preventive" },
            { value: "predictive", label: "Predictive" },
            { value: "breakdown", label: "Breakdown" },
            { value: "other", label: "Other" },
          ]}
          {...register("maintenance_type")}
        />
        <SelectField
          description="Priority is persisted and drives current maintenance read surfaces."
          error={getFieldErrorMessage(errors.priority?.message)}
          id="maintenance-priority"
          label="Priority"
          options={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
            { value: "critical", label: "Critical" },
          ]}
          {...register("priority")}
        />
        {currentStatus ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-700">Current status</p>
            <div className="mt-3">
              <MaintenanceStatusBadge status={currentStatus} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Workflow status changes remain outside FO-033 and stay read-only here.
            </p>
          </div>
        ) : null}
        <div className="md:col-span-2">
          <TextAreaField
            description="Describe the maintenance issue or requested work."
            error={getFieldErrorMessage(errors.description?.message)}
            id="maintenance-description"
            label="Description"
            textAreaProps={register("description")}
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            description="Planning notes are visible in this form, but there is no dedicated backend notes field yet."
            error={getFieldErrorMessage(errors.notes?.message)}
            id="maintenance-notes"
            label="Notes"
            textAreaProps={register("notes")}
          />
        </div>
      </TextFieldGrid>
    </MaintenanceFormSection>
  );
}

export function MaintenanceAssetSection({
  assetCode,
  assetOptions,
  errors,
  register,
}: {
  assetCode: string;
  assetOptions: { value: string; label: string }[];
  errors: FieldErrors<MaintenanceWorkOrderFormValues>;
  register: ReturnType<typeof useForm<MaintenanceWorkOrderFormValues>>["register"];
}) {
  return (
    <MaintenanceFormSection
      description="Asset selection is persisted. The selected asset also drives the current location context."
      title="Asset"
    >
      <TextFieldGrid>
        <SelectField
          description="Required by the current backend foundation."
          error={getFieldErrorMessage(errors.asset?.message)}
          id="maintenance-asset"
          label="Asset"
          options={assetOptions}
          {...register("asset")}
        />
        <TextInputField
          description="Read-only code from the selected asset record."
          disabled
          id="maintenance-asset-code"
          inputProps={{ value: assetCode }}
          label="Asset code"
        />
      </TextFieldGrid>
    </MaintenanceFormSection>
  );
}

export function MaintenanceLocationSection({
  buildingOptions,
  floorOptions,
  areaOptions,
  departmentOptions,
  errors,
  organizationOptions,
  register,
  tenantOptions,
}: {
  buildingOptions: { value: string; label: string }[];
  floorOptions: { value: string; label: string }[];
  areaOptions: { value: string; label: string }[];
  departmentOptions: { value: string; label: string }[];
  errors: FieldErrors<MaintenanceWorkOrderFormValues>;
  organizationOptions: { value: string; label: string }[];
  register: ReturnType<typeof useForm<MaintenanceWorkOrderFormValues>>["register"];
  tenantOptions: { value: string; label: string }[];
}) {
  return (
    <MaintenanceFormSection
      description="Tenant, organization, department, and location fields are persisted together with the selected asset."
      title="Location"
    >
      <TextFieldGrid>
        <SelectField
          error={getFieldErrorMessage(errors.tenant?.message)}
          id="maintenance-tenant"
          label="Tenant"
          options={tenantOptions}
          {...register("tenant")}
        />
        <SelectField
          error={getFieldErrorMessage(errors.organization?.message)}
          id="maintenance-organization"
          label="Organization"
          options={organizationOptions}
          {...register("organization")}
        />
        <SelectField
          error={getFieldErrorMessage(errors.department?.message)}
          id="maintenance-department"
          label="Department"
          options={departmentOptions}
          placeholder="Optional department"
          {...register("department")}
        />
        <TextInputField
          description="Free-text location detail is planning-only until the backend supports it."
          error={getFieldErrorMessage(errors.location_description?.message)}
          id="maintenance-location-description"
          inputProps={register("location_description")}
          label="Location description"
        />
        <SelectField
          error={getFieldErrorMessage(errors.building?.message)}
          id="maintenance-building"
          label="Building"
          options={buildingOptions}
          placeholder="Optional building"
          {...register("building")}
        />
        <SelectField
          error={getFieldErrorMessage(errors.floor?.message)}
          id="maintenance-floor"
          label="Floor"
          options={floorOptions}
          placeholder="Optional floor"
          {...register("floor")}
        />
        <SelectField
          error={getFieldErrorMessage(errors.area?.message)}
          id="maintenance-area"
          label="Area"
          options={areaOptions}
          placeholder="Optional area"
          {...register("area")}
        />
      </TextFieldGrid>
    </MaintenanceFormSection>
  );
}

export function MaintenanceAssignmentSection({
  capabilityNote,
  errors,
  register,
}: {
  capabilityNote: string | null;
  errors: FieldErrors<MaintenanceWorkOrderFormValues>;
  register: ReturnType<typeof useForm<MaintenanceWorkOrderFormValues>>["register"];
}) {
  return (
    <MaintenanceFormSection
      description="Technician and supervisor assignments are managed through the dedicated role-aware assignment workflow after the work order is created."
      title="Assignment"
    >
      {capabilityNote ? <SectionNotice tone="amber">{capabilityNote}</SectionNotice> : null}
      <TextFieldGrid>
        <TextInputField
          error={getFieldErrorMessage(errors.assignment_team?.message)}
          id="maintenance-assignment-team"
          inputProps={register("assignment_team")}
          label="Team or department assignment"
        />
      </TextFieldGrid>
    </MaintenanceFormSection>
  );
}

export function MaintenanceScheduleSection({
  errors,
  register,
}: {
  errors: FieldErrors<MaintenanceWorkOrderFormValues>;
  register: ReturnType<typeof useForm<MaintenanceWorkOrderFormValues>>["register"];
}) {
  return (
    <MaintenanceFormSection
      description="Due date and scheduled dates are validated client-side before the payload is sent."
      title="Schedule"
    >
      <TextFieldGrid>
        <TextInputField
          description="Set automatically from the current session for create and loaded from the record for edit."
          disabled
          error={getFieldErrorMessage(errors.requested_at?.message)}
          id="maintenance-requested-at"
          inputProps={register("requested_at")}
          label="Requested date"
          type="datetime-local"
        />
        <TextInputField
          error={getFieldErrorMessage(errors.due_at?.message)}
          id="maintenance-due-at"
          inputProps={register("due_at")}
          label="Due date"
          type="datetime-local"
        />
        <TextInputField
          error={getFieldErrorMessage(errors.estimated_start_at?.message)}
          id="maintenance-estimated-start-at"
          inputProps={register("estimated_start_at")}
          label="Estimated start date"
          type="datetime-local"
        />
        <TextInputField
          error={getFieldErrorMessage(errors.estimated_completion_at?.message)}
          id="maintenance-estimated-completion-at"
          inputProps={register("estimated_completion_at")}
          label="Estimated completion date"
          type="datetime-local"
        />
        <TextInputField
          description="Planning-only until the backend exposes a dedicated estimated-hours field."
          error={getFieldErrorMessage(errors.estimated_hours?.message)}
          id="maintenance-estimated-hours"
          inputProps={register("estimated_hours")}
          label="Estimated hours"
          type="number"
        />
      </TextFieldGrid>
    </MaintenanceFormSection>
  );
}

export function MaintenanceTaskFormSection({
  control,
  errors,
  register,
  capabilityNote,
}: {
  control: Control<MaintenanceWorkOrderFormValues>;
  errors: FieldErrors<MaintenanceWorkOrderFormValues>;
  register: ReturnType<typeof useForm<MaintenanceWorkOrderFormValues>>["register"];
  capabilityNote: string | null;
}) {
  const { append, fields, remove } = useFieldArray({
    control,
    name: "tasks",
  });

  return (
    <MaintenanceFormSection
      description="Task rows can be added and removed in the form even though line-item persistence is still pending in the backend."
      title="Tasks"
    >
      {capabilityNote ? <SectionNotice tone="amber">{capabilityNote}</SectionNotice> : null}
      <div className="flex justify-end">
        <MaintenanceSectionHeaderAction
          label="Add task"
          onClick={() => append(createEmptyMaintenanceTask(fields.length + 1))}
        />
      </div>
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div
            className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
            key={field.id}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Task {index + 1}
              </h3>
              <button
                className="text-sm font-medium text-red-700 hover:text-red-800"
                onClick={() => remove(index)}
                type="button"
              >
                Remove
              </button>
            </div>
            <TextFieldGrid>
              <TextInputField
                error={getTaskError(errors, index, "title")}
                id={`maintenance-task-title-${index}`}
                inputProps={register(`tasks.${index}.title`)}
                label="Task name"
              />
              <TextInputField
                error={getTaskError(errors, index, "estimated_hours")}
                id={`maintenance-task-hours-${index}`}
                inputProps={register(`tasks.${index}.estimated_hours`)}
                label="Estimated hours"
                type="number"
              />
              <TextInputField
                error={getTaskError(errors, index, "sequence")}
                id={`maintenance-task-sequence-${index}`}
                inputProps={register(`tasks.${index}.sequence`)}
                label="Sequence"
                type="number"
              />
              <div className="md:col-span-2">
                <TextAreaField
                  error={getTaskError(errors, index, "description")}
                  id={`maintenance-task-description-${index}`}
                  label="Description"
                  textAreaProps={register(`tasks.${index}.description`)}
                />
              </div>
              <SwitchField
                description="Flag whether this task is mandatory for the work plan."
                error={getTaskError(errors, index, "required")}
                id={`maintenance-task-required-${index}`}
                label="Required"
                {...register(`tasks.${index}.required`)}
              />
            </TextFieldGrid>
          </div>
        ))}
      </div>
    </MaintenanceFormSection>
  );
}

export function MaintenanceMaterialFormSection({
  capabilityNote,
  control,
  errors,
  register,
}: {
  capabilityNote: string | null;
  control: Control<MaintenanceWorkOrderFormValues>;
  errors: FieldErrors<MaintenanceWorkOrderFormValues>;
  register: ReturnType<typeof useForm<MaintenanceWorkOrderFormValues>>["register"];
}) {
  const { append, fields, remove } = useFieldArray({
    control,
    name: "materials",
  });

  return (
    <MaintenanceFormSection
      description="Material rows support planning and validation now; backend persistence is deferred."
      title="Materials"
    >
      {capabilityNote ? <SectionNotice tone="amber">{capabilityNote}</SectionNotice> : null}
      <div className="flex justify-end">
        <MaintenanceSectionHeaderAction
          label="Add material"
          onClick={() => append(createEmptyMaintenanceMaterial())}
        />
      </div>
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div
            className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
            key={field.id}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Material {index + 1}
              </h3>
              <button
                className="text-sm font-medium text-red-700 hover:text-red-800"
                onClick={() => remove(index)}
                type="button"
              >
                Remove
              </button>
            </div>
            <TextFieldGrid>
              <TextInputField
                error={getMaterialError(errors, index, "name")}
                id={`maintenance-material-name-${index}`}
                inputProps={register(`materials.${index}.name`)}
                label="Material name"
              />
              <TextInputField
                error={getMaterialError(errors, index, "quantity")}
                id={`maintenance-material-quantity-${index}`}
                inputProps={register(`materials.${index}.quantity`)}
                label="Quantity"
                type="number"
              />
              <TextInputField
                error={getMaterialError(errors, index, "unit")}
                id={`maintenance-material-unit-${index}`}
                inputProps={register(`materials.${index}.unit`)}
                label="Unit"
              />
              <TextInputField
                error={getMaterialError(errors, index, "estimated_cost")}
                id={`maintenance-material-cost-${index}`}
                inputProps={register(`materials.${index}.estimated_cost`)}
                label="Estimated cost"
                type="number"
              />
              <div className="md:col-span-2">
                <TextAreaField
                  error={getMaterialError(errors, index, "notes")}
                  id={`maintenance-material-notes-${index}`}
                  label="Notes"
                  textAreaProps={register(`materials.${index}.notes`)}
                />
              </div>
            </TextFieldGrid>
          </div>
        ))}
      </div>
    </MaintenanceFormSection>
  );
}

export function MaintenanceLaborFormSection({
  capabilityNote,
  control,
  errors,
  register,
}: {
  capabilityNote: string | null;
  control: Control<MaintenanceWorkOrderFormValues>;
  errors: FieldErrors<MaintenanceWorkOrderFormValues>;
  register: ReturnType<typeof useForm<MaintenanceWorkOrderFormValues>>["register"];
}) {
  const { append, fields, remove } = useFieldArray({
    control,
    name: "labor",
  });

  return (
    <MaintenanceFormSection
      description="Labor planning rows validate positive hours but are not persisted by the current work-order endpoints."
      title="Labor"
    >
      {capabilityNote ? <SectionNotice tone="amber">{capabilityNote}</SectionNotice> : null}
      <div className="flex justify-end">
        <MaintenanceSectionHeaderAction
          label="Add labor entry"
          onClick={() => append(createEmptyMaintenanceLabor())}
        />
      </div>
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div
            className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
            key={field.id}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Labor {index + 1}
              </h3>
              <button
                className="text-sm font-medium text-red-700 hover:text-red-800"
                onClick={() => remove(index)}
                type="button"
              >
                Remove
              </button>
            </div>
            <TextFieldGrid>
              <TextInputField
                error={getLaborError(errors, index, "estimated_hours")}
                id={`maintenance-labor-hours-${index}`}
                inputProps={register(`labor.${index}.estimated_hours`)}
                label="Estimated hours"
                type="number"
              />
              <TextInputField
                error={getLaborError(errors, index, "rate")}
                id={`maintenance-labor-rate-${index}`}
                inputProps={register(`labor.${index}.rate`)}
                label="Rate"
                type="number"
              />
              <div className="md:col-span-2">
                <TextAreaField
                  error={getLaborError(errors, index, "notes")}
                  id={`maintenance-labor-notes-${index}`}
                  label="Notes"
                  textAreaProps={register(`labor.${index}.notes`)}
                />
              </div>
            </TextFieldGrid>
          </div>
        ))}
      </div>
    </MaintenanceFormSection>
  );
}

export function MaintenanceAttachmentSection({
  capabilityNote,
}: {
  capabilityNote: string | null;
}) {
  return (
    <MaintenanceFormSection
      description="Attachment upload is deferred until the backend exposes an upload endpoint for maintenance work orders."
      title="Attachments"
    >
      <SectionNotice tone="amber">
        {capabilityNote ||
          "Attachment upload is not available in the current backend foundation."}
      </SectionNotice>
      <FormField
        description="Visible placeholder only. No files will be uploaded from this screen yet."
        htmlFor="maintenance-attachments"
        label="Attachment upload"
      >
        <input
          className="block w-full cursor-not-allowed rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-slate-500"
          disabled
          id="maintenance-attachments"
          type="file"
        />
      </FormField>
    </MaintenanceFormSection>
  );
}

export function MaintenanceFormActions({
  cancelHref,
  draftNote,
  isSubmitting,
  submitLabel,
}: {
  cancelHref: string;
  draftNote: string | null;
  isSubmitting: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4 border-t border-slate-200 pt-6">
      {draftNote ? <SectionNotice tone="slate">{draftNote}</SectionNotice> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Link
          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          href={cancelHref}
        >
          Cancel
        </Link>
        <button
          className="inline-flex cursor-not-allowed items-center justify-center rounded-md border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500"
          disabled
          type="button"
        >
          Save draft unavailable
        </button>
        <button
          className="inline-flex items-center justify-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </div>
  );
}

export function MaintenanceFormSkeleton() {
  return (
    <div className="space-y-4">
      <LoadingState
        title="Loading maintenance form"
        message="Fetching the work order and related reference data."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
            key={index}
          />
        ))}
      </div>
    </div>
  );
}

export function MaintenanceFormErrorState({
  message,
  title,
}: {
  message: string;
  title: string;
}) {
  return <ErrorState message={message} title={title} />;
}

export interface MaintenanceWorkOrderFormProps {
  cancelHref: string;
  currentStatus?: MaintenanceWorkOrderStatus;
  formOptions: MaintenanceFormOptions;
  initialValues: MaintenanceWorkOrderFormValues;
  isSubmitting: boolean;
  onSubmit: (values: MaintenanceWorkOrderFormValues) => void | Promise<void>;
  submitLabel: string;
}

export function MaintenanceWorkOrderForm({
  cancelHref,
  currentStatus,
  formOptions,
  initialValues,
  isSubmitting,
  onSubmit,
  submitLabel,
}: MaintenanceWorkOrderFormProps) {
  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<MaintenanceWorkOrderFormValues>({
    resolver: zodResolver(maintenanceWorkOrderSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  useUnsavedChangesPrompt(isDirty && !isSubmitting);

  const selectedTenant = useWatch({ control, name: "tenant" });
  const selectedOrganization = useWatch({ control, name: "organization" });
  const selectedBuilding = useWatch({ control, name: "building" });
  const selectedFloor = useWatch({ control, name: "floor" });
  const selectedArea = useWatch({ control, name: "area" });
  const selectedAssetId = useWatch({ control, name: "asset" });

  const selectedAsset = useMemo(
    () => formOptions.assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [formOptions.assets, selectedAssetId],
  );

  useEffect(() => {
    if (!selectedAsset) {
      return;
    }

    setValue("tenant", selectedAsset.tenant, { shouldDirty: false });
    setValue("organization", selectedAsset.organization, { shouldDirty: false });
    setValue("building", selectedAsset.building, { shouldDirty: false });
    setValue("floor", selectedAsset.floor ?? "", { shouldDirty: false });
    setValue("area", selectedAsset.area ?? "", { shouldDirty: false });
  }, [selectedAsset, setValue]);

  const filteredOrganizations = filterOrganizationsByTenant(
    formOptions.organizations,
    selectedTenant,
  );
  const filteredDepartments = filterDepartments(
    formOptions.departments,
    selectedTenant,
    selectedOrganization,
  );
  const filteredBuildings = filterBuildingsByOrganization(
    filterBuildingsByTenant(formOptions.buildings, selectedTenant),
    selectedOrganization,
  );
  const filteredFloors = filterFloorsByBuilding(
    formOptions.floors,
    selectedBuilding,
  );
  const filteredAreas = filterAreas(
    formOptions.areas,
    selectedBuilding,
    selectedFloor,
  );
  const filteredAssets = filterAssets(
    formOptions.assets,
    selectedOrganization,
    selectedBuilding,
    selectedFloor,
    selectedArea,
  );
  const capabilityNotes = getMaintenanceCapabilityNotes(formOptions);

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(sanitizeMaintenanceFormValues(values));
      })}
    >
      <MaintenanceBasicInfoSection
        currentStatus={currentStatus}
        errors={errors}
        register={register}
      />
      <MaintenanceAssetSection
        assetCode={selectedAsset?.code ?? ""}
        assetOptions={buildRecordOptions(filteredAssets)}
        errors={errors}
        register={register}
      />
      <MaintenanceLocationSection
        areaOptions={buildRecordOptions(filteredAreas)}
        buildingOptions={buildRecordOptions(filteredBuildings)}
        departmentOptions={buildRecordOptions(filteredDepartments)}
        errors={errors}
        floorOptions={buildRecordOptions(filteredFloors)}
        organizationOptions={buildRecordOptions(filteredOrganizations)}
        register={register}
        tenantOptions={buildRecordOptions(formOptions.tenants)}
      />
      <MaintenanceAssignmentSection
        capabilityNote={capabilityNotes.assignments}
        errors={errors}
        register={register}
      />
      <MaintenanceScheduleSection errors={errors} register={register} />
      <MaintenanceTaskFormSection
        capabilityNote={capabilityNotes.tasks}
        control={control}
        errors={errors}
        register={register}
      />
      <MaintenanceMaterialFormSection
        capabilityNote={capabilityNotes.tasks}
        control={control}
        errors={errors}
        register={register}
      />
      <MaintenanceLaborFormSection
        capabilityNote={capabilityNotes.tasks}
        control={control}
        errors={errors}
        register={register}
      />
      <MaintenanceAttachmentSection capabilityNote={capabilityNotes.attachments} />
      <MaintenanceFormActions
        cancelHref={cancelHref}
        draftNote={capabilityNotes.draft}
        isSubmitting={isSubmitting}
        submitLabel={submitLabel}
      />
    </form>
  );
}
