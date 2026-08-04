import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

import { omitBlankReportingParams } from "@/lib/reporting/filters";
import type {
  AIInsightsParams,
  AIRecommendationInsights,
} from "@/types/ai-insights";
import type {
  AIOperationalInsights,
  AIOperationalInsightsParams,
} from "@/types/ai-operational-insights";
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

export function getAIRecommendationInsights(
  params?: AIInsightsParams,
): Promise<AIRecommendationInsights> {
  const query = omitBlankReportingParams(params ?? {});

  return apiClient<AIRecommendationInsights>(
    API_ENDPOINTS.reporting.aiInsights,
    {
      method: "GET",
      query,
    },
  );
}

export function getAIOperationalInsights(
  params?: AIOperationalInsightsParams,
): Promise<AIOperationalInsights> {
  const query = omitBlankReportingParams(params ?? {});

  return apiClient<AIOperationalInsights>(
    API_ENDPOINTS.reporting.aiOperationalInsights,
    {
      method: "GET",
      query,
    },
  );
}
