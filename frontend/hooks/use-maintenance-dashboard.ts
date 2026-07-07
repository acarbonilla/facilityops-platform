"use client";

import { useQuery } from "@tanstack/react-query";

import { getMaintenanceDashboard } from "@/services/api/maintenance";
import { maintenanceQueryKeys } from "@/services/api/query-keys";
import type { MaintenanceListParams } from "@/types/maintenance";

export function useMaintenanceDashboard(params?: MaintenanceListParams) {
  return useQuery({
    queryKey: maintenanceQueryKeys.dashboard(params),
    queryFn: () => getMaintenanceDashboard(params),
  });
}
