"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { FormActions } from "@/components/common/form-actions";
import { SelectField } from "@/components/common/select-field";
import { fmTicketSchema } from "@/lib/validations/fm-tickets";
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
  Building,
  Department,
  Floor,
  Organization,
  Tenant,
} from "@/types/master-data";
import type {
  FmTicketFormValues,
  FmTicketStatus,
} from "@/types/fm-tickets";

import { TicketStatusBadge } from "./ticket-status-badge";

function TicketFormSection({
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
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

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
  areas: Area[],
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

function getDefaultValues(
  initialValues?: Partial<FmTicketFormValues>,
): FmTicketFormValues {
  return {
    tenant: initialValues?.tenant ?? "",
    organization: initialValues?.organization ?? "",
    department: initialValues?.department ?? "",
    building: initialValues?.building ?? "",
    floor: initialValues?.floor ?? "",
    area: initialValues?.area ?? "",
    asset: initialValues?.asset ?? "",
    title: initialValues?.title ?? "",
    description: initialValues?.description ?? "",
    category: initialValues?.category ?? "other",
    priority: initialValues?.priority ?? "medium",
    source: initialValues?.source ?? "web",
    due_at: initialValues?.due_at ?? "",
    status: initialValues?.status ?? "open",
    assignee: initialValues?.assignee ?? "",
  };
}

export interface TicketFormProps {
  initialValues?: Partial<FmTicketFormValues>;
  onSubmit: (values: FmTicketFormValues) => void | Promise<void>;
  isSubmitting: boolean;
  submitLabel: string;
  cancelHref: string;
  tenants: Tenant[];
  organizations: Organization[];
  departments: Department[];
  buildings: Building[];
  floors: Floor[];
  areas: Area[];
  assets: Asset[];
  currentStatus?: FmTicketStatus;
}

export function TicketForm({
  areas,
  assets,
  buildings,
  cancelHref,
  currentStatus,
  departments,
  floors,
  initialValues,
  isSubmitting,
  onSubmit,
  organizations,
  submitLabel,
  tenants,
}: TicketFormProps) {
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<FmTicketFormValues>({
    resolver: zodResolver(fmTicketSchema),
    defaultValues: getDefaultValues(initialValues),
  });
  const selectedTenant = useWatch({ control, name: "tenant" });
  const selectedOrganization = useWatch({ control, name: "organization" });
  const selectedBuilding = useWatch({ control, name: "building" });
  const selectedFloor = useWatch({ control, name: "floor" });
  const selectedArea = useWatch({ control, name: "area" });

  const filteredOrganizations = filterOrganizationsByTenant(
    organizations,
    selectedTenant,
  );
  const filteredDepartments = filterDepartments(
    departments,
    selectedTenant,
    selectedOrganization,
  );
  const filteredBuildings = filterBuildingsByOrganization(
    filterBuildingsByTenant(buildings, selectedTenant),
    selectedOrganization,
  );
  const filteredFloors = filterFloorsByBuilding(floors, selectedBuilding);
  const filteredAreas = filterAreas(areas, selectedBuilding, selectedFloor);
  const filteredAssets = filterAssets(
    assets,
    selectedOrganization,
    selectedBuilding,
    selectedFloor,
    selectedArea,
  );

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values);
      })}
    >
      <TicketFormSection
        description="Define the issue, classify it, and keep the source aligned with the backend ticket foundation."
        title="Ticket Information"
      >
        <TextInputField
          description="Short title used in FM ticket lists and detail headers."
          error={getFieldErrorMessage(errors.title?.message)}
          id="ticket-title"
          inputProps={register("title")}
          label="Title"
        />
        <SelectField
          description="Select the operational category for this ticket."
          error={getFieldErrorMessage(errors.category?.message)}
          label="Category"
          options={[
            { value: "electrical", label: "Electrical" },
            { value: "plumbing", label: "Plumbing" },
            { value: "hvac", label: "HVAC" },
            { value: "civil", label: "Civil" },
            { value: "safety", label: "Safety" },
            { value: "cleaning", label: "Cleaning" },
            { value: "security", label: "Security" },
            { value: "other", label: "Other" },
          ]}
          {...register("category")}
        />
        <SelectField
          description="Priority affects how the ticket is surfaced in read views."
          error={getFieldErrorMessage(errors.priority?.message)}
          label="Priority"
          options={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
            { value: "urgent", label: "Urgent" },
          ]}
          {...register("priority")}
        />
        <SelectField
          description="Source remains editable because the current backend create/update serializers accept it."
          error={getFieldErrorMessage(errors.source?.message)}
          label="Source"
          options={[
            { value: "web", label: "Web" },
            { value: "mobile", label: "Mobile" },
            { value: "admin", label: "Admin" },
            { value: "inspection", label: "Inspection" },
            { value: "system", label: "System" },
          ]}
          {...register("source")}
        />
        {currentStatus ? (
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-700">Current status</p>
            <div className="mt-3">
              <TicketStatusBadge status={currentStatus} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Status workflow controls are intentionally out of scope for this task.
            </p>
          </div>
        ) : null}
        <div className="md:col-span-2">
          <TextAreaField
            description="Describe the issue in enough detail for downstream review."
            error={getFieldErrorMessage(errors.description?.message)}
            id="ticket-description"
            label="Description"
            textAreaProps={register("description")}
          />
        </div>
      </TicketFormSection>

      <TicketFormSection
        description="Reuse existing master-data options and keep filtering client-side and lightweight."
        title="Location"
      >
        <SelectField
          description="Top-level tenant ownership for this FM ticket."
          error={getFieldErrorMessage(errors.tenant?.message)}
          label="Tenant"
          options={buildRecordOptions(tenants)}
          {...register("tenant")}
        />
        <SelectField
          description="Organizations are narrowed by the selected tenant."
          error={getFieldErrorMessage(errors.organization?.message)}
          label="Organization"
          options={buildRecordOptions(filteredOrganizations)}
          {...register("organization")}
        />
        <SelectField
          description="Departments are optional and filtered by the selected organization when available."
          error={getFieldErrorMessage(errors.department?.message)}
          label="Department"
          options={buildRecordOptions(filteredDepartments)}
          placeholder="Optional department"
          {...register("department")}
        />
        <SelectField
          description="Buildings are narrowed by the selected tenant and organization."
          error={getFieldErrorMessage(errors.building?.message)}
          label="Building"
          options={buildRecordOptions(filteredBuildings)}
          {...register("building")}
        />
        <SelectField
          description="Floors are optional and filtered by the selected building."
          error={getFieldErrorMessage(errors.floor?.message)}
          label="Floor"
          options={buildRecordOptions(filteredFloors)}
          placeholder="Optional floor"
          {...register("floor")}
        />
        <SelectField
          description="Areas are optional and filtered by the selected floor when available."
          error={getFieldErrorMessage(errors.area?.message)}
          label="Area"
          options={buildRecordOptions(filteredAreas)}
          placeholder="Optional area"
          {...register("area")}
        />
        <SelectField
          description="Assets are optional and filtered by the selected organization and location fields."
          error={getFieldErrorMessage(errors.asset?.message)}
          label="Asset"
          options={buildRecordOptions(filteredAssets)}
          placeholder="Optional asset"
          {...register("asset")}
        />
      </TicketFormSection>

      <TicketFormSection
        description="Only due date editing is enabled in this task. Assignee and workflow changes stay out of scope because the current backend serializers do not accept them."
        title="Dates and Workflow Scope"
      >
        <TextInputField
          description="Optional due date sent to the backend as an ISO timestamp on submit."
          error={getFieldErrorMessage(errors.due_at?.message)}
          id="ticket-due-at"
          inputProps={register("due_at")}
          label="Due date"
          type="datetime-local"
        />
      </TicketFormSection>

      <FormActions
        cancelHref={cancelHref}
        isSubmitting={isSubmitting}
        submitLabel={submitLabel}
      />
    </form>
  );
}
