"use client";

import { startWorkOrder } from "@/services/api/maintenance";
import type { MaintenanceSimpleWorkflowPayload } from "@/types/maintenance";

import { useMaintenanceWorkflowMutation } from "./use-maintenance-workflow-mutation";

export function useStartWorkOrder(id: string, sourceTicketId?: string | null) {
  return useMaintenanceWorkflowMutation<MaintenanceSimpleWorkflowPayload | undefined>(
    id,
    (payload) => startWorkOrder(id, payload),
    { sourceTicketId },
  );
}
