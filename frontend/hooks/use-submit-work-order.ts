"use client";

import { submitWorkOrder } from "@/services/api/maintenance";
import type { MaintenanceSimpleWorkflowPayload } from "@/types/maintenance";

import { useMaintenanceWorkflowMutation } from "./use-maintenance-workflow-mutation";

export function useSubmitWorkOrder(id: string) {
  return useMaintenanceWorkflowMutation<MaintenanceSimpleWorkflowPayload | undefined>(
    id,
    (payload) => submitWorkOrder(id, payload),
  );
}
