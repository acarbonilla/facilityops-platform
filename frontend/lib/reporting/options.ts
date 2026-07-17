import type { SelectOption } from "@/components/common/select-field";
import type { FmTicketPriority, FmTicketStatus } from "@/types/fm-tickets";
import type { InspectionStatus } from "@/types/inspection";
import type {
  MaintenanceWorkOrderPriority,
  MaintenanceWorkOrderStatus,
} from "@/types/maintenance";

export const REPORTING_TICKET_STATUS_VALUES: FmTicketStatus[] = [
  "draft",
  "open",
  "assigned",
  "in_progress",
  "on_hold",
  "resolved",
  "closed",
  "cancelled",
];

export const REPORTING_TICKET_PRIORITY_VALUES: FmTicketPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];

export const REPORTING_WORK_ORDER_STATUS_VALUES: MaintenanceWorkOrderStatus[] = [
  "draft",
  "open",
  "assigned",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
  "reopened",
  "closed",
];

export const REPORTING_WORK_ORDER_PRIORITY_VALUES: MaintenanceWorkOrderPriority[] =
  ["low", "medium", "high", "critical"];

export const REPORTING_INSPECTION_STATUS_VALUES: InspectionStatus[] = [
  "draft",
  "scheduled",
  "in_progress",
  "completed",
  "verified",
  "cancelled",
  "reopened",
];

function toOptions(values: string[]): SelectOption[] {
  return values.map((value) => ({
    value,
    label: value
      .replace(/[_-]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  }));
}

export const REPORTING_TICKET_STATUS_OPTIONS = toOptions(
  REPORTING_TICKET_STATUS_VALUES,
);
export const REPORTING_TICKET_PRIORITY_OPTIONS = toOptions(
  REPORTING_TICKET_PRIORITY_VALUES,
);
export const REPORTING_WORK_ORDER_STATUS_OPTIONS = toOptions(
  REPORTING_WORK_ORDER_STATUS_VALUES,
);
export const REPORTING_WORK_ORDER_PRIORITY_OPTIONS = toOptions(
  REPORTING_WORK_ORDER_PRIORITY_VALUES,
);
export const REPORTING_INSPECTION_STATUS_OPTIONS = toOptions(
  REPORTING_INSPECTION_STATUS_VALUES,
);

export function isReportingTicketStatus(value: string): value is FmTicketStatus {
  return (REPORTING_TICKET_STATUS_VALUES as string[]).includes(value);
}

export function isReportingTicketPriority(
  value: string,
): value is FmTicketPriority {
  return (REPORTING_TICKET_PRIORITY_VALUES as string[]).includes(value);
}

export function isReportingWorkOrderStatus(
  value: string,
): value is MaintenanceWorkOrderStatus {
  return (REPORTING_WORK_ORDER_STATUS_VALUES as string[]).includes(value);
}

export function isReportingWorkOrderPriority(
  value: string,
): value is MaintenanceWorkOrderPriority {
  return (REPORTING_WORK_ORDER_PRIORITY_VALUES as string[]).includes(value);
}

export function isReportingInspectionStatus(
  value: string,
): value is InspectionStatus {
  return (REPORTING_INSPECTION_STATUS_VALUES as string[]).includes(value);
}
