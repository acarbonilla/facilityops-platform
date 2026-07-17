export type ReportingCountDictionary = Record<string, number>;

export interface ReportingOverviewParams
  extends Record<string, string | undefined> {
  date_from?: string;
  date_to?: string;
  building?: string;
  organization?: string;
  ticket_status?: string;
  ticket_priority?: string;
  work_order_status?: string;
  work_order_priority?: string;
  inspection_status?: string;
}

export interface ReportingOrganizationOption {
  id: string;
  name: string;
}

export interface ReportingBuildingOption {
  id: string;
  name: string;
  organization_id: string;
}

export interface ReportingFilterOptionsResponse {
  organizations: ReportingOrganizationOption[];
  buildings: ReportingBuildingOption[];
}

export interface ReportingFiltersEcho {
  date_from: string;
  date_to: string;
  building?: string | null;
  organization?: string | null;
  ticket_status?: string | null;
  ticket_priority?: string | null;
  work_order_status?: string | null;
  work_order_priority?: string | null;
  inspection_status?: string | null;
}

export interface ReportingTicketSlaSummary {
  response_met: number;
  response_missed: number;
  resolution_met: number;
  resolution_missed: number;
}

export interface ReportingTicketSummary {
  total: number;
  open: number;
  overdue: number;
  by_status: ReportingCountDictionary;
  by_priority: ReportingCountDictionary;
  by_category: ReportingCountDictionary;
  sla: ReportingTicketSlaSummary;
}

export interface ReportingWorkOrderSummary {
  total: number;
  overdue: number;
  by_status: ReportingCountDictionary;
  by_priority: ReportingCountDictionary;
  linked_to_ticket: number;
  standalone: number;
}

export interface ReportingInspectionSummary {
  total: number;
  by_status: ReportingCountDictionary;
  average_score: number | null;
  scored_count: number;
}

export interface ReportingOperationalOverview {
  filters: ReportingFiltersEcho;
  tickets: ReportingTicketSummary;
  work_orders: ReportingWorkOrderSummary;
  inspections: ReportingInspectionSummary;
}

/** Draft filter controls use local YYYY-MM-DD date strings. */
export interface ReportingFilterDraft {
  dateFrom: string;
  dateTo: string;
  organization: string;
  building: string;
  ticketStatus?: string;
  ticketPriority?: string;
  workOrderStatus?: string;
  workOrderPriority?: string;
  inspectionStatus?: string;
}

export type ReportingActiveFilters = ReportingFilterDraft;
