"use client";

import { useQuery } from "@tanstack/react-query";

import { getMaintenanceFormOptions } from "@/services/api/maintenance";
import { maintenanceQueryKeys } from "@/services/api/query-keys";

export function useMaintenanceFormOptions() {
  return useQuery({
    queryKey: maintenanceQueryKeys.formOptions(),
    queryFn: getMaintenanceFormOptions,
  });
}
