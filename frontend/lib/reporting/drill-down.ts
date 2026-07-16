import { getSafeNotificationTargetUrl } from "@/lib/notifications/display";
import {
  isReportingInspectionStatus,
  isReportingTicketPriority,
  isReportingTicketStatus,
  isReportingWorkOrderPriority,
  isReportingWorkOrderStatus,
} from "@/lib/reporting/options";
import type { ReportingActiveFilters } from "@/types/reporting";

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
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
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
  const createdFrom = toDateOnly(filters.dateFrom);
  const createdTo = toDateOnly(filters.dateTo);
  if (createdFrom) appendParam(params, "created_from", createdFrom);
  if (createdTo) appendParam(params, "created_to", createdTo);
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
