"use client";

import { useQuery } from "@tanstack/react-query";

import { getMaintenanceDetail } from "@/services/api/maintenance";
import { maintenanceQueryKeys } from "@/services/api/query-keys";

export function useMaintenanceDetail(id: string) {
  return useQuery({
    queryKey: maintenanceQueryKeys.detail(id),
    queryFn: () => getMaintenanceDetail(id),
    enabled: Boolean(id),
  });
}
