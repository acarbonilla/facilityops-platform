import {
  getDefaultReportingDateRange,
  toReportingApiDateBounds,
  validateReportingDateRange,
} from "./dates";

import type {
  ReportingActiveFilters,
  ReportingFilterDraft,
  ReportingOverviewParams,
} from "@/types/reporting";

export function createDefaultReportingFilters(
  reference: Date = new Date(),
): ReportingFilterDraft {
  const { dateFrom, dateTo } = getDefaultReportingDateRange(reference);
  return {
    dateFrom,
    dateTo,
    organization: "",
    building: "",
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

  return params;
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

function toIdSet(ids: Set<string> | string[]): Set<string> {
  return ids instanceof Set ? ids : new Set(ids);
}
