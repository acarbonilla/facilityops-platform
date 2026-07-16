import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

import { omitBlankReportingParams } from "@/lib/reporting/filters";
import type {
  ReportingFilterOptionsResponse,
  ReportingOperationalOverview,
  ReportingOverviewParams,
} from "@/types/reporting";

export function getReportingOverview(
  params?: ReportingOverviewParams,
): Promise<ReportingOperationalOverview> {
  const query = omitBlankReportingParams(params ?? {});

  return apiClient<ReportingOperationalOverview>(
    API_ENDPOINTS.reporting.overview,
    {
      method: "GET",
      query,
    },
  );
}

export function getReportingFilterOptions(): Promise<ReportingFilterOptionsResponse> {
  return apiClient<ReportingFilterOptionsResponse>(
    API_ENDPOINTS.reporting.filterOptions,
    {
      method: "GET",
    },
  );
}
