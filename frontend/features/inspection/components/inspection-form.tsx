"use client";

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
import { FormActions } from "@/components/common/form-actions";
import { LoadingState } from "@/components/common/loading-state";
import { SelectField } from "@/components/common/select-field";
import { useUnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-prompt";
import {
  createEmptyInspectionItem,
  getInspectionCapabilityNotes,
  sanitizeInspectionFormValues,
} from "@/lib/inspection/form";
import { inspectionFormSchema } from "@/lib/validations/inspection";
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
import type { Department } from "@/types/master-data";
import type {
  InspectionFormOptions,
  InspectionFormValues,
  InspectionItemFormValues,
  InspectionStatus,
} from "@/types/inspection";

import { InspectionStatusBadge } from "./inspection-status-badge";

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

function filterAreas(
  areas: InspectionFormOptions["areas"],
  buildingId: string,
  floorId: string,
) {
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

function InspectionFormSection({
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
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {children}
    </div>
  );
}

function SectionHeaderAction({
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

function PassFailField({
  error,
  name,
  register,
}: {
  error?: string;
  name: `items.${number}.is_pass`;
  register: ReturnType<typeof useForm<InspectionFormValues>>["register"];
}) {
  return (
    <SelectField
      error={error}
      id={name}
      label="Pass / Fail"
      options={[
        { value: "true", label: "Pass" },
        { value: "false", label: "Fail" },
      ]}
      placeholder="Not scored"
      {...register(name)}
    />
  );
}

function getInspectionItemError(
  errors: FieldErrors<InspectionFormValues>,
  index: number,
  key: keyof InspectionItemFormValues,
) {
  return getFieldErrorMessage(
    errors.items?.[index]?.[key]?.message as string | undefined,
  );
}

function InspectionBasicInfoSection({
  currentStatus,
  errors,
  register,
}: {
  currentStatus?: InspectionStatus;
  errors: FieldErrors<InspectionFormValues>;
  register: ReturnType<typeof useForm<InspectionFormValues>>["register"];
}) {
  return (
    <InspectionFormSection
      description="Define the inspection title, classification, priority, and template context."
      title="Basic Information"
    >
      <TextFieldGrid>
        <TextInputField
          error={getFieldErrorMessage(errors.title?.message)}
          id="inspection-title"
          inputProps={register("title")}
          label="Title"
        />
        <SelectField
          error={getFieldErrorMessage(errors.inspection_type?.message)}
          id="inspection-type"
          label="Inspection type"
          options={[
            { value: "routine", label: "Routine" },
            { value: "audit", label: "Audit" },
            { value: "spot_check", label: "Spot Check" },
            { value: "follow_up", label: "Follow Up" },
          ]}
          {...register("inspection_type")}
        />
        <SelectField
          error={getFieldErrorMessage(errors.five_s_category?.message)}
          id="inspection-five-s-category"
          label="5S category"
          options={[
            { value: "sort", label: "Sort" },
            { value: "set_in_order", label: "Set In Order" },
            { value: "shine", label: "Shine" },
            { value: "standardize", label: "Standardize" },
            { value: "sustain", label: "Sustain" },
          ]}
          {...register("five_s_category")}
        />
        <SelectField
          error={getFieldErrorMessage(errors.priority?.message)}
          id="inspection-priority"
          label="Priority"
          options={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
            { value: "critical", label: "Critical" },
          ]}
          {...register("priority")}
        />
        <TextInputField
          description="Optional template label carried by the current inspection API."
          error={getFieldErrorMessage(errors.inspection_template?.message)}
          id="inspection-template"
          inputProps={register("inspection_template")}
          label="Inspection template"
        />
        {currentStatus ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-700">Current status</p>
            <div className="mt-3">
              <InspectionStatusBadge status={currentStatus} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Workflow status changes remain outside FO-040 and stay read-only
              here.
            </p>
          </div>
        ) : null}
      </TextFieldGrid>
    </InspectionFormSection>
  );
}

function InspectionLocationSection({
  areaOptions,
  buildingOptions,
  departmentOptions,
  errors,
  floorOptions,
  organizationOptions,
  register,
  tenantOptions,
}: {
  areaOptions: { value: string; label: string }[];
  buildingOptions: { value: string; label: string }[];
  departmentOptions: { value: string; label: string }[];
  errors: FieldErrors<InspectionFormValues>;
  floorOptions: { value: string; label: string }[];
  organizationOptions: { value: string; label: string }[];
  register: ReturnType<typeof useForm<InspectionFormValues>>["register"];
  tenantOptions: { value: string; label: string }[];
}) {
  return (
    <InspectionFormSection
      description="Persist tenant, organization, and location context for the inspection."
      title="Location"
    >
      <TextFieldGrid>
        <SelectField
          error={getFieldErrorMessage(errors.tenant?.message)}
          id="inspection-tenant"
          label="Tenant"
          options={tenantOptions}
          {...register("tenant")}
        />
        <SelectField
          error={getFieldErrorMessage(errors.organization?.message)}
          id="inspection-organization"
          label="Organization"
          options={organizationOptions}
          {...register("organization")}
        />
        <SelectField
          error={getFieldErrorMessage(errors.department?.message)}
          id="inspection-department"
          label="Department"
          options={departmentOptions}
          placeholder="Optional department"
          {...register("department")}
        />
        <SelectField
          error={getFieldErrorMessage(errors.building?.message)}
          id="inspection-building"
          label="Building"
          options={buildingOptions}
          {...register("building")}
        />
        <SelectField
          error={getFieldErrorMessage(errors.floor?.message)}
          id="inspection-floor"
          label="Floor"
          options={floorOptions}
          placeholder="Optional floor"
          {...register("floor")}
        />
        <SelectField
          error={getFieldErrorMessage(errors.area?.message)}
          id="inspection-area"
          label="Area"
          options={areaOptions}
          placeholder="Optional area"
          {...register("area")}
        />
      </TextFieldGrid>
    </InspectionFormSection>
  );
}

function InspectionAssignmentSection({
  capabilityNote,
  inspectorLabel,
  register,
  scheduledDateError,
  scheduledDateRegister,
  supervisorLabel,
}: {
  capabilityNote?: string | null;
  inspectorLabel?: string | null;
  register: ReturnType<typeof useForm<InspectionFormValues>>["register"];
  scheduledDateError?: string;
  scheduledDateRegister: ReturnType<typeof useForm<InspectionFormValues>>["register"];
  supervisorLabel?: string | null;
}) {
  return (
    <InspectionFormSection
      description="Planning ownership and schedule while user-directory selection remains unavailable."
      title="Assignment and Planning"
    >
      {capabilityNote ? <SectionNotice>{capabilityNote}</SectionNotice> : null}
      <input type="hidden" {...register("inspector")} />
      <input type="hidden" {...register("supervisor")} />
      <TextFieldGrid>
        <TextInputField
          description="The current frontend cannot browse user records yet."
          disabled
          id="inspection-inspector"
          inputProps={{
            value: inspectorLabel || "Backend default on create / not assigned",
          }}
          label="Inspector"
        />
        <TextInputField
          description="Supervisor assignment remains read-only until a supported user API exists."
          disabled
          id="inspection-supervisor"
          inputProps={{ value: supervisorLabel || "Not assigned" }}
          label="Supervisor"
        />
        <TextInputField
          description="Optional schedule target for the inspection."
          error={scheduledDateError}
          id="inspection-scheduled-date"
          inputProps={scheduledDateRegister("scheduled_date")}
          label="Scheduled date"
          type="datetime-local"
        />
      </TextFieldGrid>
    </InspectionFormSection>
  );
}

function InspectionChecklistItemsSection({
  control,
  errors,
  register,
}: {
  control: Control<InspectionFormValues>;
  errors: FieldErrors<InspectionFormValues>;
  register: ReturnType<typeof useForm<InspectionFormValues>>["register"];
}) {
  const { append, fields, remove } = useFieldArray({
    control,
    name: "items",
  });

  return (
    <InspectionFormSection
      description="Manage the checklist rows that the inspection create and update API persists."
      title="Checklist Items"
    >
      <div className="flex justify-end">
        <SectionHeaderAction
          label="Add checklist item"
          onClick={() => append(createEmptyInspectionItem(fields.length + 1))}
        />
      </div>
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-4"
            key={field.id}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Checklist item {index + 1}
                </h3>
                <p className="text-sm text-slate-500">
                  Sequence, scoring, and observation fields are persisted.
                </p>
              </div>
              <button
                className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => remove(index)}
                type="button"
              >
                Remove
              </button>
            </div>
            <TextFieldGrid>
              <TextInputField
                error={getInspectionItemError(errors, index, "sequence")}
                id={`inspection-item-sequence-${index}`}
                inputProps={register(`items.${index}.sequence`)}
                label="Sequence"
              />
              <TextInputField
                error={getInspectionItemError(errors, index, "max_score")}
                id={`inspection-item-max-score-${index}`}
                inputProps={register(`items.${index}.max_score`)}
                label="Max score"
              />
              <TextInputField
                error={getInspectionItemError(errors, index, "checklist_item")}
                id={`inspection-item-checklist-${index}`}
                inputProps={register(`items.${index}.checklist_item`)}
                label="Checklist item"
              />
              <TextInputField
                error={getInspectionItemError(errors, index, "category")}
                id={`inspection-item-category-${index}`}
                inputProps={register(`items.${index}.category`)}
                label="Category"
              />
              <TextAreaField
                error={getInspectionItemError(errors, index, "expected_result")}
                id={`inspection-item-expected-result-${index}`}
                label="Expected result"
                textAreaProps={register(`items.${index}.expected_result`)}
              />
              <TextInputField
                error={getInspectionItemError(errors, index, "score")}
                id={`inspection-item-score-${index}`}
                inputProps={register(`items.${index}.score`)}
                label="Score"
              />
              <PassFailField
                error={getInspectionItemError(errors, index, "is_pass")}
                name={`items.${index}.is_pass`}
                register={register}
              />
              <TextAreaField
                error={getInspectionItemError(errors, index, "observation")}
                id={`inspection-item-observation-${index}`}
                label="Observation"
                textAreaProps={register(`items.${index}.observation`)}
              />
              <div className="md:col-span-2">
                <TextAreaField
                  error={getInspectionItemError(errors, index, "notes")}
                  id={`inspection-item-notes-${index}`}
                  label="Notes"
                  textAreaProps={register(`items.${index}.notes`)}
                />
              </div>
            </TextFieldGrid>
          </div>
        ))}
      </div>
    </InspectionFormSection>
  );
}

function InspectionRemarksSection({
  errors,
  register,
}: {
  errors: FieldErrors<InspectionFormValues>;
  register: ReturnType<typeof useForm<InspectionFormValues>>["register"];
}) {
  return (
    <InspectionFormSection
      description="Persist optional summary remarks for the inspection record."
      title="Remarks"
    >
      <TextAreaField
        error={getFieldErrorMessage(errors.remarks?.message)}
        id="inspection-remarks"
        label="Remarks"
        textAreaProps={register("remarks")}
      />
    </InspectionFormSection>
  );
}

export function InspectionFormErrorState({
  message,
  title,
}: {
  message: string;
  title: string;
}) {
  return <ErrorState message={message} title={title} />;
}

export function InspectionFormSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <LoadingState
        message="Loading inspection details, form defaults, and option lists."
        title="Loading inspection form"
      />
    </div>
  );
}

export interface InspectionFormProps {
  cancelHref: string;
  currentStatus?: InspectionStatus;
  formOptions: InspectionFormOptions;
  initialValues: InspectionFormValues;
  inspectorLabel?: string | null;
  isSubmitting: boolean;
  onSubmit: (values: InspectionFormValues) => void | Promise<void>;
  submitLabel: string;
  supervisorLabel?: string | null;
}

export function InspectionForm({
  cancelHref,
  currentStatus,
  formOptions,
  initialValues,
  inspectorLabel,
  isSubmitting,
  onSubmit,
  submitLabel,
  supervisorLabel,
}: InspectionFormProps) {
  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
  } = useForm<InspectionFormValues>({
    resolver: zodResolver(inspectionFormSchema),
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

  const filteredOrganizations = useMemo(
    () =>
      filterOrganizationsByTenant(formOptions.organizations, selectedTenant),
    [formOptions.organizations, selectedTenant],
  );
  const filteredDepartments = useMemo(
    () =>
      filterDepartments(
        formOptions.departments,
        selectedTenant,
        selectedOrganization,
      ),
    [formOptions.departments, selectedOrganization, selectedTenant],
  );
  const filteredBuildings = useMemo(
    () =>
      filterBuildingsByOrganization(
        filterBuildingsByTenant(formOptions.buildings, selectedTenant),
        selectedOrganization,
      ),
    [formOptions.buildings, selectedOrganization, selectedTenant],
  );
  const filteredFloors = useMemo(
    () => filterFloorsByBuilding(formOptions.floors, selectedBuilding),
    [formOptions.floors, selectedBuilding],
  );
  const filteredAreas = useMemo(
    () => filterAreas(formOptions.areas, selectedBuilding, selectedFloor),
    [formOptions.areas, selectedBuilding, selectedFloor],
  );
  const capabilityNotes = getInspectionCapabilityNotes(formOptions);

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(sanitizeInspectionFormValues(values));
      })}
    >
      <InspectionBasicInfoSection
        currentStatus={currentStatus}
        errors={errors}
        register={register}
      />
      <InspectionLocationSection
        areaOptions={buildRecordOptions(filteredAreas)}
        buildingOptions={buildRecordOptions(filteredBuildings)}
        departmentOptions={buildRecordOptions(filteredDepartments)}
        errors={errors}
        floorOptions={buildRecordOptions(filteredFloors)}
        organizationOptions={buildRecordOptions(filteredOrganizations)}
        register={register}
        tenantOptions={buildRecordOptions(formOptions.tenants)}
      />
      <InspectionAssignmentSection
        capabilityNote={capabilityNotes.userDirectory}
        inspectorLabel={inspectorLabel}
        register={register}
        scheduledDateError={getFieldErrorMessage(errors.scheduled_date?.message)}
        scheduledDateRegister={register}
        supervisorLabel={supervisorLabel}
      />
      <InspectionChecklistItemsSection
        control={control}
        errors={errors}
        register={register}
      />
      <InspectionRemarksSection errors={errors} register={register} />
      <FormActions
        cancelHref={cancelHref}
        isSubmitting={isSubmitting}
        submitLabel={submitLabel}
      />
    </form>
  );
}
