"use client";

import { reassignWorkOrder } from "@/services/api/maintenance";
import type { MaintenanceReassignPayload } from "@/types/maintenance";

import { useMaintenanceWorkflowMutation } from "./use-maintenance-workflow-mutation";

export function useReassignWorkOrder(id: string) {
  return useMaintenanceWorkflowMutation<MaintenanceReassignPayload>(id, (payload) =>
    reassignWorkOrder(id, payload),
  );
}
