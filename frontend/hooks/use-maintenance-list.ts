"use client";

import { useQuery } from "@tanstack/react-query";

import { getMaintenanceList } from "@/services/api/maintenance";
import { maintenanceQueryKeys } from "@/services/api/query-keys";
import type { MaintenanceListParams } from "@/types/maintenance";

export function useMaintenanceList(params?: MaintenanceListParams) {
  return useQuery({
    queryKey: maintenanceQueryKeys.list(params),
    queryFn: () => getMaintenanceList(params),
  });
}
