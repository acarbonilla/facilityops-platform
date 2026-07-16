"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { REPORTING_PERMISSION } from "@/lib/reporting/navigation";
import {
  getReportingFilterOptions,
  getReportingOverview,
} from "@/services/api/reporting";
import { reportingQueryKeys } from "@/services/api/query-keys";
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
