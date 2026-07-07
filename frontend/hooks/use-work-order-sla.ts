"use client";

import { useQuery } from "@tanstack/react-query";

import { getWorkOrderSLA, recalculateWorkOrderSLA } from "@/services/api/maintenance";
import { maintenanceQueryKeys } from "@/services/api/query-keys";

import { useMaintenanceWorkflowMutation } from "./use-maintenance-workflow-mutation";

export function useWorkOrderSLA(id: string, enabled = true) {
  return useQuery({
    queryKey: maintenanceQueryKeys.sla(id),
    queryFn: () => getWorkOrderSLA(id),
    enabled,
  });
}

export function useRecalculateWorkOrderSLA(id: string) {
  return useMaintenanceWorkflowMutation<void>(id, () => recalculateWorkOrderSLA(id));
}
