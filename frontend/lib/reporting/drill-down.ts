import { getSafeNotificationTargetUrl } from "@/lib/notifications/display";
import {
  isReportingInspectionStatus,
  isReportingTicketPriority,
  isReportingTicketStatus,
  isReportingWorkOrderPriority,
  isReportingWorkOrderStatus,
} from "@/lib/reporting/options";
import type { ReportingActiveFilters } from "@/types/reporting";
import { isValidDateOnly } from "@/lib/reporting/dates";

function appendParam(
  params: URLSearchParams,
  key: string,
  value?: string | null,
) {
  const trimmed = value?.trim();
  if (trimmed) {
    params.set(key, trimmed);
  }
}

function toDateOnly(value: string): string | null {
  const trimmed = value.trim();
  return isValidDateOnly(trimmed) ? trimmed : null;
}

function buildInternalUrl(pathname: string, params: URLSearchParams): string | null {
  const query = params.toString();
  return getSafeNotificationTargetUrl(query ? `${pathname}?${query}` : pathname);
}

export function buildTicketDrillDownHref(
  filters: ReportingActiveFilters,
): string | null {
  const params = new URLSearchParams();
  if (filters.ticketStatus && isReportingTicketStatus(filters.ticketStatus)) {
    appendParam(params, "status", filters.ticketStatus);
  }
  if (filters.ticketPriority && isReportingTicketPriority(filters.ticketPriority)) {
    appendParam(params, "priority", filters.ticketPriority);
  }
  appendParam(params, "organization", filters.organization);
  appendParam(params, "building", filters.building);
  appendParam(params, "from", "reporting");
  return buildInternalUrl("/fm-tickets", params);
}

export function buildWorkOrderDrillDownHref(
  filters: ReportingActiveFilters,
): string | null {
  const params = new URLSearchParams();
  if (
    filters.workOrderStatus &&
    isReportingWorkOrderStatus(filters.workOrderStatus)
  ) {
    appendParam(params, "status", filters.workOrderStatus);
  }
  if (
    filters.workOrderPriority &&
    isReportingWorkOrderPriority(filters.workOrderPriority)
  ) {
    appendParam(params, "priority", filters.workOrderPriority);
  }
  appendParam(params, "organization", filters.organization);
  appendParam(params, "building", filters.building);
  const requestedFrom = toDateOnly(filters.dateFrom);
  const requestedTo = toDateOnly(filters.dateTo);
  if (requestedFrom) appendParam(params, "requested_from", requestedFrom);
  if (requestedTo) appendParam(params, "requested_to", requestedTo);
  appendParam(params, "from", "reporting");
  return buildInternalUrl("/maintenance/work-orders", params);
}

export function buildInspectionDrillDownHref(
  filters: ReportingActiveFilters,
): string | null {
  const params = new URLSearchParams();
  if (
    filters.inspectionStatus &&
    isReportingInspectionStatus(filters.inspectionStatus)
  ) {
    appendParam(params, "status", filters.inspectionStatus);
  }
  appendParam(params, "organization", filters.organization);
  appendParam(params, "building", filters.building);
  appendParam(params, "from", "reporting");
  return buildInternalUrl("/inspection/inspections", params);
}
