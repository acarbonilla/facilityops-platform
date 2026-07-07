"use client";

import { reopenWorkOrder } from "@/services/api/maintenance";
import type { MaintenanceReopenPayload } from "@/types/maintenance";

import { useMaintenanceWorkflowMutation } from "./use-maintenance-workflow-mutation";

export function useReopenWorkOrder(id: string) {
  return useMaintenanceWorkflowMutation<MaintenanceReopenPayload>(id, (payload) =>
    reopenWorkOrder(id, payload),
  );
}
