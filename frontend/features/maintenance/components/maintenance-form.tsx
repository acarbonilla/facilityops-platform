"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import {
  useForm,
  useWatch,
  type FieldErrors,
} from "react-hook-form";

import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { SelectField } from "@/components/common/select-field";
import { useUnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-prompt";
import {
  formatMaintenanceError,
  formatMaintenanceValidationMessages,
} from "@/lib/maintenance/display";
import { maintenanceWorkOrderSchema } from "@/lib/validations/maintenance";
import {
  getMaintenanceCapabilityNotes,
  MAINTENANCE_FORM_API_FIELD_MAP,
  MAINTENANCE_FORM_WORKFLOW_GUIDANCE,
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
import { ApiError } from "@/services/api/types";
import type {
  Area,
  Asset,
  Department,
} from "@/types/master-data";
import type {
  MaintenanceFormOptions,
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
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SectionNotice({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "amber" | "slate";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-slate-200 bg-white text-slate-700";

  return (
    <p className={`rounded-lg border p-3 text-sm ${toneClass}`} role="note">
      {children}
    </p>
  );
}

function TextFieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 md:grid-cols-2">{children}</div>;
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
      description="Core fields persisted by the current create and update APIs."
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
              Status changes are managed from Work Order Details, not this form.
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
      description="Asset is required. The selected asset also drives the current location context."
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
        <SelectField
          description="Required by the current backend foundation."
          error={getFieldErrorMessage(errors.building?.message)}
          id="maintenance-building"
          label="Building"
          options={buildingOptions}
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
}: {
  capabilityNote: string | null;
}) {
  return (
    <MaintenanceFormSection
      description="Technician and Supervisor assignments stay on Work Order Details after the record exists."
      title="Assignment"
    >
      {capabilityNote ? <SectionNotice tone="amber">{capabilityNote}</SectionNotice> : null}
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
          label="Scheduled start"
          type="datetime-local"
        />
        <TextInputField
          error={getFieldErrorMessage(errors.estimated_completion_at?.message)}
          id="maintenance-estimated-completion-at"
          inputProps={register("estimated_completion_at")}
          label="Scheduled end"
          type="datetime-local"
        />
      </TextFieldGrid>
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
      description="Attachment upload remains deferred until the Maintenance upload workflow is available."
      title="Attachments"
    >
      <SectionNotice tone="amber">
        {capabilityNote ||
          "Attachments can be added when the Maintenance upload workflow becomes available."}
      </SectionNotice>
    </MaintenanceFormSection>
  );
}

export function MaintenanceFormActions({
  cancelHref,
  isSubmitting,
  submitLabel,
}: {
  cancelHref: string;
  isSubmitting: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4 border-t border-slate-200 pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Link
          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          href={cancelHref}
        >
          Cancel
        </Link>
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
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
    setError,
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
  const capabilityNotes = getMaintenanceCapabilityNotes();

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit(async (values) => {
        setFormError(null);
        try {
          await onSubmit(sanitizeMaintenanceFormValues(values));
        } catch (error) {
          if (error instanceof ApiError) {
            const unmatchedMessages: string[] = [];

            for (const [field, messages] of Object.entries(
              error.details?.errors ?? {},
            )) {
              const formField = MAINTENANCE_FORM_API_FIELD_MAP[field];
              if (formField && messages[0]) {
                setError(formField, {
                  message: messages[0],
                  type: "server",
                });
              } else {
                unmatchedMessages.push(
                  ...formatMaintenanceValidationMessages({
                    [field]: messages,
                  }),
                );
              }
            }

            setFormError(
              unmatchedMessages[0] ??
                formatMaintenanceError(
                  error,
                  "The maintenance work order could not be saved.",
                ),
            );
            return;
          }

          setFormError(
            formatMaintenanceError(
              error,
              "The maintenance work order could not be saved.",
            ),
          );
        }
      })}
    >
      {formError ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {formError}
        </p>
      ) : null}
      <SectionNotice tone="slate">{MAINTENANCE_FORM_WORKFLOW_GUIDANCE}</SectionNotice>
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
      <MaintenanceAssignmentSection capabilityNote={capabilityNotes.assignments} />
      <MaintenanceScheduleSection errors={errors} register={register} />
      <MaintenanceAttachmentSection capabilityNote={capabilityNotes.attachments} />
      <MaintenanceFormActions
        cancelHref={cancelHref}
        isSubmitting={isSubmitting}
        submitLabel={submitLabel}
      />
    </form>
  );
}
