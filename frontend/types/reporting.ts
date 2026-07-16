export type ReportingCountDictionary = Record<string, number>;

export interface ReportingOverviewParams
  extends Record<string, string | undefined> {
  date_from?: string;
  date_to?: string;
  building?: string;
  organization?: string;
}

export interface ReportingFiltersEcho {
  date_from: string;
  date_to: string;
  building?: string | null;
  organization?: string | null;
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
}

export interface ReportingActiveFilters {
  dateFrom: string;
  dateTo: string;
  organization: string;
  building: string;
}
