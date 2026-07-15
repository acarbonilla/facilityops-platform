"use client";

import { holdWorkOrder } from "@/services/api/maintenance";
import type { MaintenanceHoldPayload } from "@/types/maintenance";

import { useMaintenanceWorkflowMutation } from "./use-maintenance-workflow-mutation";

export function useHoldWorkOrder(id: string, sourceTicketId?: string | null) {
  return useMaintenanceWorkflowMutation<MaintenanceHoldPayload>(
    id,
    (payload) => holdWorkOrder(id, payload),
    { sourceTicketId },
  );
}
