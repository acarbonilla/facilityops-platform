"use client";

import { cancelWorkOrder } from "@/services/api/maintenance";
import type { MaintenanceCancelPayload } from "@/types/maintenance";

import { useMaintenanceWorkflowMutation } from "./use-maintenance-workflow-mutation";

export function useCancelWorkOrder(id: string, sourceTicketId?: string | null) {
  return useMaintenanceWorkflowMutation<MaintenanceCancelPayload>(
    id,
    (payload) => cancelWorkOrder(id, payload),
    { sourceTicketId },
  );
}
