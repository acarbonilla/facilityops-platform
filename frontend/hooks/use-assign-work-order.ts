"use client";

import { assignWorkOrder } from "@/services/api/maintenance";
import type { MaintenanceAssignPayload } from "@/types/maintenance";

import { useMaintenanceWorkflowMutation } from "./use-maintenance-workflow-mutation";

export function useAssignWorkOrder(id: string) {
  return useMaintenanceWorkflowMutation<MaintenanceAssignPayload>(id, (payload) =>
    assignWorkOrder(id, payload),
  );
}
