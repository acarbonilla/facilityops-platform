"use client";

import { completeWorkOrder } from "@/services/api/maintenance";
import type { MaintenanceCompletePayload } from "@/types/maintenance";

import { useMaintenanceWorkflowMutation } from "./use-maintenance-workflow-mutation";

export function useCompleteWorkOrder(id: string) {
  return useMaintenanceWorkflowMutation<MaintenanceCompletePayload>(id, (payload) =>
    completeWorkOrder(id, payload),
  );
}
