"use client";

import { resumeWorkOrder } from "@/services/api/maintenance";
import type { MaintenanceSimpleWorkflowPayload } from "@/types/maintenance";

import { useMaintenanceWorkflowMutation } from "./use-maintenance-workflow-mutation";

export function useResumeWorkOrder(id: string, sourceTicketId?: string | null) {
  return useMaintenanceWorkflowMutation<MaintenanceSimpleWorkflowPayload | undefined>(
    id,
    (payload) => resumeWorkOrder(id, payload),
    { sourceTicketId },
  );
}
