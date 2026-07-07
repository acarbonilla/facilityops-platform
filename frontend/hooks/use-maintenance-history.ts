"use client";

import { useQuery } from "@tanstack/react-query";

import { getMaintenanceHistory } from "@/services/api/maintenance";
import { maintenanceQueryKeys } from "@/services/api/query-keys";

export function useMaintenanceHistory(id: string) {
  return useQuery({
    queryKey: maintenanceQueryKeys.history(id),
    queryFn: () => getMaintenanceHistory(id),
    enabled: Boolean(id),
  });
}
