"use client";

import { cancelInspection } from "@/services/api/inspection";
import type { InspectionCancelPayload } from "@/types/inspection";

import { useInspectionWorkflowMutation } from "./use-inspection-workflow-mutation";

export function useCancelInspection(id: string) {
  return useInspectionWorkflowMutation<InspectionCancelPayload>(id, (payload) =>
    cancelInspection(id, payload),
  );
}
