import {
  getDefaultReportingDateRange,
  toReportingApiDateBounds,
  validateReportingDateRange,
} from "./dates";
import {
  formatReportingPriorityLabel,
  formatReportingStatusLabel,
} from "./display";
import {
  isReportingInspectionStatus,
  isReportingTicketPriority,
  isReportingTicketStatus,
  isReportingWorkOrderPriority,
  isReportingWorkOrderStatus,
} from "./options";

import type {
  ReportingActiveFilters,
  ReportingFilterDraft,
  ReportingOverviewParams,
} from "@/types/reporting";

const EMPTY_MODULE_FILTERS = {
  ticketStatus: "",
  ticketPriority: "",
  workOrderStatus: "",
  workOrderPriority: "",
  inspectionStatus: "",
} as const;

export function createDefaultReportingFilters(
  reference: Date = new Date(),
): ReportingFilterDraft {
  const { dateFrom, dateTo } = getDefaultReportingDateRange(reference);
  return {
    dateFrom,
    dateTo,
    organization: "",
    building: "",
    ...EMPTY_MODULE_FILTERS,
  };
}

export function resetReportingFilters(
  reference: Date = new Date(),
): ReportingFilterDraft {
  return createDefaultReportingFilters(reference);
}

export function clearIncompatibleBuilding(
  organizationId: string,
  buildingId: string,
  buildings: Array<{ id: string; organization_id: string }>,
): string {
  if (!buildingId) {
    return "";
  }

  if (!organizationId) {
    return buildingId;
  }

  const selected = buildings.find((building) => building.id === buildingId);
  if (!selected || selected.organization_id !== organizationId) {
    return "";
  }

  return buildingId;
}

export function filterReportingBuildingsByOrganization(
  buildings: Array<{ id: string; name: string; organization_id: string }>,
  organizationId: string,
) {
  if (!organizationId) {
    return buildings;
  }

  return buildings.filter(
    (building) => building.organization_id === organizationId,
  );
}

export function serializeReportingOverviewParams(
  filters: ReportingActiveFilters,
): ReportingOverviewParams | null {
  const bounds = toReportingApiDateBounds(filters.dateFrom, filters.dateTo);
  if (!bounds) {
    return null;
  }

  const params: ReportingOverviewParams = {
    date_from: bounds.date_from,
    date_to: bounds.date_to,
  };

  const organization = filters.organization.trim();
  const building = filters.building.trim();

  if (organization) {
    params.organization = organization;
  }

  if (building) {
    params.building = building;
  }

  appendCanonicalModuleParam(
    params,
    "ticket_status",
    filters.ticketStatus ?? "",
    isReportingTicketStatus,
  );
  appendCanonicalModuleParam(
    params,
    "ticket_priority",
    filters.ticketPriority ?? "",
    isReportingTicketPriority,
  );
  appendCanonicalModuleParam(
    params,
    "work_order_status",
    filters.workOrderStatus ?? "",
    isReportingWorkOrderStatus,
  );
  appendCanonicalModuleParam(
    params,
    "work_order_priority",
    filters.workOrderPriority ?? "",
    isReportingWorkOrderPriority,
  );
  appendCanonicalModuleParam(
    params,
    "inspection_status",
    filters.inspectionStatus ?? "",
    isReportingInspectionStatus,
  );

  return params;
}

function appendCanonicalModuleParam(
  params: ReportingOverviewParams,
  key:
    | "ticket_status"
    | "ticket_priority"
    | "work_order_status"
    | "work_order_priority"
    | "inspection_status",
  value: string,
  isValid: (candidate: string) => boolean,
) {
  const trimmed = value.trim();
  if (trimmed && isValid(trimmed)) {
    params[key] = trimmed;
  }
}

export function omitBlankReportingParams(
  params: ReportingOverviewParams,
): ReportingOverviewParams {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      if (value === undefined || value === null) {
        return false;
      }
      if (typeof value === "string" && value.trim() === "") {
        return false;
      }
      return true;
    }),
  ) as ReportingOverviewParams;
}

export function canApplyReportingFilters(
  draft: ReportingFilterDraft,
  options?: {
    organizationIds?: Set<string> | string[];
    buildingIds?: Set<string> | string[];
    optionsReady?: boolean;
  },
): boolean {
  if (validateReportingDateRange(draft.dateFrom, draft.dateTo)) {
    return false;
  }

  if (draft.ticketStatus && !isReportingTicketStatus(draft.ticketStatus)) {
    return false;
  }
  if (draft.ticketPriority && !isReportingTicketPriority(draft.ticketPriority)) {
    return false;
  }
  if (
    draft.workOrderStatus &&
    !isReportingWorkOrderStatus(draft.workOrderStatus)
  ) {
    return false;
  }
  if (
    draft.workOrderPriority &&
    !isReportingWorkOrderPriority(draft.workOrderPriority)
  ) {
    return false;
  }
  if (
    draft.inspectionStatus &&
    !isReportingInspectionStatus(draft.inspectionStatus)
  ) {
    return false;
  }

  const organization = draft.organization.trim();
  const building = draft.building.trim();
  const optionsReady = options?.optionsReady ?? true;

  if (!optionsReady && (organization || building)) {
    return false;
  }

  if (organization && options?.organizationIds) {
    const allowed = toIdSet(options.organizationIds);
    if (!allowed.has(organization)) {
      return false;
    }
  }

  if (building && options?.buildingIds) {
    const allowed = toIdSet(options.buildingIds);
    if (!allowed.has(building)) {
      return false;
    }
  }

  return true;
}

/** Period fragment without a leading "Period" label (for "Current period: …"). */
export function formatReportingActivePeriod(
  filters: Pick<ReportingActiveFilters, "dateFrom" | "dateTo">,
): string {
  return `${filters.dateFrom} to ${filters.dateTo}`;
}

/**
 * Active-filter summary. Period text does not include a "Period" prefix so
 * callers can render "Current period: {summary}" without duplication.
 * Independent callers that want an explicit Period label should prepend it.
 */
export function formatActiveReportingFilterSummary(
  filters: ReportingActiveFilters,
  labels?: {
    organizationName?: string | null;
    buildingName?: string | null;
  },
): string {
  const parts: string[] = [formatReportingActivePeriod(filters)];

  if (filters.organization) {
    parts.push(
      `Organization: ${labels?.organizationName?.trim() || filters.organization}`,
    );
  }

  if (filters.building) {
    parts.push(
      `Building: ${labels?.buildingName?.trim() || filters.building}`,
    );
  }

  if (filters.ticketStatus) {
    parts.push(
      `Ticket Status: ${formatReportingStatusLabel(filters.ticketStatus)}`,
    );
  }
  if (filters.ticketPriority) {
    parts.push(
      `Ticket Priority: ${formatReportingPriorityLabel(filters.ticketPriority)}`,
    );
  }
  if (filters.workOrderStatus) {
    parts.push(
      `Work Order Status: ${formatReportingStatusLabel(filters.workOrderStatus)}`,
    );
  }
  if (filters.workOrderPriority) {
    parts.push(
      `Work Order Priority: ${formatReportingPriorityLabel(filters.workOrderPriority)}`,
    );
  }
  if (filters.inspectionStatus) {
    parts.push(
      `Inspection Status: ${formatReportingStatusLabel(filters.inspectionStatus)}`,
    );
  }

  return parts.join(" · ");
}

export function formatCurrentReportingPeriodLabel(
  filters: ReportingActiveFilters,
  labels?: {
    organizationName?: string | null;
    buildingName?: string | null;
  },
): string {
  return `Current period: ${formatActiveReportingFilterSummary(filters, labels)}`;
}

export function hasActiveMasterDataFilters(
  filters: Pick<ReportingActiveFilters, "organization" | "building">,
): boolean {
  return Boolean(filters.organization.trim() || filters.building.trim());
}

export function hasActiveModuleFilters(
  filters: Pick<
    ReportingActiveFilters,
    | "ticketStatus"
    | "ticketPriority"
    | "workOrderStatus"
    | "workOrderPriority"
    | "inspectionStatus"
  >,
): boolean {
  return Boolean(
    filters.ticketStatus?.trim() ||
      filters.ticketPriority?.trim() ||
      filters.workOrderStatus?.trim() ||
      filters.workOrderPriority?.trim() ||
      filters.inspectionStatus?.trim(),
  );
}

function toIdSet(ids: Set<string> | string[]): Set<string> {
  return ids instanceof Set ? ids : new Set(ids);
}
