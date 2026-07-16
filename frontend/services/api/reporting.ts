import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

import { omitBlankReportingParams } from "@/lib/reporting/filters";
import type {
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
