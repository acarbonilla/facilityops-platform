"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { REPORTING_PERMISSION } from "@/lib/reporting/navigation";
import { getReportingOverview } from "@/services/api/reporting";
import { reportingQueryKeys } from "@/services/api/query-keys";
import type { ReportingOverviewParams } from "@/types/reporting";

export function useReportingOverview(params?: ReportingOverviewParams) {
  const { isAuthenticated, isLoading } = useAuth();
  const { hasPermission, permissionsLoading } = usePermissions();

  const enabled =
    !isLoading &&
    isAuthenticated &&
    !permissionsLoading &&
    hasPermission(REPORTING_PERMISSION);

  return useQuery({
    queryKey: reportingQueryKeys.overview(params),
    queryFn: () => getReportingOverview(params),
    enabled,
  });
}
