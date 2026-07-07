"use client";

import { unassignWorkOrder } from "@/services/api/maintenance";
import type { MaintenanceUnassignPayload } from "@/types/maintenance";

import { useMaintenanceWorkflowMutation } from "./use-maintenance-workflow-mutation";

export function useUnassignWorkOrder(id: string) {
  return useMaintenanceWorkflowMutation<MaintenanceUnassignPayload>(id, (payload) =>
    unassignWorkOrder(id, payload),
  );
}
