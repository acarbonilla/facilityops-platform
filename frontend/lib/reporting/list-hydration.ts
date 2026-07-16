import {
  isReportingInspectionStatus,
  isReportingTicketPriority,
  isReportingTicketStatus,
  isReportingWorkOrderPriority,
  isReportingWorkOrderStatus,
} from "@/lib/reporting/options";
import type {
  FmTicketCategory,
  FmTicketPriority,
  FmTicketStatus,
} from "@/types/fm-tickets";
import type { InspectionListFilters } from "@/types/inspection";
import type { MaintenanceListFilters } from "@/types/maintenance";

export interface TicketListHydrationFilters {
  search: string;
  status: FmTicketStatus | "";
  priority: FmTicketPriority | "";
  category: FmTicketCategory | "";
  organization: string;
  building: string;
  assignee: string;
}

function readParam(
  params: URLSearchParams | Record<string, string | null | undefined>,
  key: string,
): string {
  if (params instanceof URLSearchParams) {
    return params.get(key)?.trim() ?? "";
  }
  const value = params[key];
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function hydrateTicketListFilters(
  params: URLSearchParams | Record<string, string | null | undefined>,
  defaults: TicketListHydrationFilters,
): TicketListHydrationFilters {
  const status = readParam(params, "status");
  const priority = readParam(params, "priority");
  const building = readParam(params, "building");
  const organization = readParam(params, "organization");
  return {
    ...defaults,
    status: isReportingTicketStatus(status) ? status : defaults.status,
    priority: isReportingTicketPriority(priority) ? priority : defaults.priority,
    building: isUuid(building) ? building : defaults.building,
    organization: isUuid(organization) ? organization : defaults.organization,
  };
}

export function hydrateMaintenanceListFilters(
  params: URLSearchParams | Record<string, string | null | undefined>,
  defaults: MaintenanceListFilters,
): MaintenanceListFilters {
  const status = readParam(params, "status");
  const priority = readParam(params, "priority");
  const building = readParam(params, "building");
  const organization = readParam(params, "organization");
  const createdFrom = readParam(params, "created_from");
  const createdTo = readParam(params, "created_to");
  return {
    ...defaults,
    status: isReportingWorkOrderStatus(status) ? status : defaults.status,
    priority: isReportingWorkOrderPriority(priority)
      ? priority
      : defaults.priority,
    building: isUuid(building) ? building : defaults.building,
    organization: isUuid(organization) ? organization : defaults.organization,
    createdFrom: isDateOnly(createdFrom) ? createdFrom : defaults.createdFrom,
    createdTo: isDateOnly(createdTo) ? createdTo : defaults.createdTo,
  };
}

export function hydrateInspectionListFilters(
  params: URLSearchParams | Record<string, string | null | undefined>,
  defaults: InspectionListFilters,
): InspectionListFilters {
  const status = readParam(params, "status");
  const building = readParam(params, "building");
  const organization = readParam(params, "organization");
  return {
    ...defaults,
    status: isReportingInspectionStatus(status) ? status : defaults.status,
    building: isUuid(building) ? building : defaults.building,
    organization: isUuid(organization) ? organization : defaults.organization,
  };
}

export function isReportingReturnParam(
  params: URLSearchParams | Record<string, string | null | undefined>,
): boolean {
  return readParam(params, "from") === "reporting";
}
