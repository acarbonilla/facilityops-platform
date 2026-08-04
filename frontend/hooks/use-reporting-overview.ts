"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { REPORTING_PERMISSION } from "@/lib/reporting/navigation";
import {
  getAIAttentionCenter,
  getAIOperationalInsights,
  getAIRecommendationInsights,
  getAISimilarCases,
  getExecutiveAIDashboard,
  getReportingFilterOptions,
  getReportingOverview,
} from "@/services/api/reporting";
import { reportingQueryKeys } from "@/services/api/query-keys";
import type { AIAttentionCenterParams } from "@/types/ai-attention-center";
import type { AIInsightsParams } from "@/types/ai-insights";
import type { AIOperationalInsightsParams } from "@/types/ai-operational-insights";
import type { AISimilarCasesParams } from "@/types/ai-similar-cases";
import type { ExecutiveAIDashboardParams } from "@/types/ai-executive-dashboard";
import type { ReportingOverviewParams } from "@/types/reporting";

function useReportingQueriesEnabled() {
  const { isAuthenticated, isLoading } = useAuth();
  const { hasPermission, permissionsLoading } = usePermissions();

  return (
    !isLoading &&
    isAuthenticated &&
    !permissionsLoading &&
    hasPermission(REPORTING_PERMISSION)
  );
}

export function useReportingOverview(params?: ReportingOverviewParams) {
  const enabled = useReportingQueriesEnabled();

  return useQuery({
    queryKey: reportingQueryKeys.overview(params),
    queryFn: () => getReportingOverview(params),
    enabled,
  });
}

export function useReportingFilterOptions() {
  const enabled = useReportingQueriesEnabled();

  return useQuery({
    queryKey: reportingQueryKeys.filterOptions(),
    queryFn: getReportingFilterOptions,
    enabled,
  });
}

export function useAIRecommendationInsights(params?: AIInsightsParams | null) {
  const enabled = useReportingQueriesEnabled() && Boolean(params);

  return useQuery({
    queryKey: reportingQueryKeys.aiInsights(params ?? undefined),
    queryFn: () => getAIRecommendationInsights(params ?? undefined),
    enabled,
  });
}

export function useAIOperationalInsights(
  params?: AIOperationalInsightsParams | null,
) {
  const enabled = useReportingQueriesEnabled() && Boolean(params);

  return useQuery({
    queryKey: reportingQueryKeys.aiOperationalInsights(params ?? undefined),
    queryFn: () => getAIOperationalInsights(params ?? undefined),
    enabled,
  });
}

export function useAIAttentionCenter(
  params?: AIAttentionCenterParams | null,
) {
  const enabled = useReportingQueriesEnabled() && Boolean(params);

  return useQuery({
    queryKey: reportingQueryKeys.aiAttentionCenter(params ?? undefined),
    queryFn: () => getAIAttentionCenter(params ?? undefined),
    enabled,
  });
}

export function useAISimilarCases(params?: AISimilarCasesParams | null) {
  const enabled = useReportingQueriesEnabled() && Boolean(params);

  return useQuery({
    queryKey: reportingQueryKeys.aiSimilarCases(params ?? undefined),
    queryFn: () => getAISimilarCases(params ?? undefined),
    enabled,
  });
}

export function useExecutiveAIDashboard(
  params?: ExecutiveAIDashboardParams | null,
) {
  const enabled = useReportingQueriesEnabled() && Boolean(params);

  return useQuery({
    queryKey: reportingQueryKeys.aiExecutiveDashboard(params ?? undefined),
    queryFn: () => getExecutiveAIDashboard(params ?? undefined),
    enabled,
  });
}
