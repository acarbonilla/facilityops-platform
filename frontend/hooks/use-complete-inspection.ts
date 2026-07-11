"use client";

import { completeInspection } from "@/services/api/inspection";
import type { InspectionSimpleWorkflowPayload } from "@/types/inspection";

import { useInspectionWorkflowMutation } from "./use-inspection-workflow-mutation";

export function useCompleteInspection(id: string) {
  return useInspectionWorkflowMutation<InspectionSimpleWorkflowPayload | undefined>(
    id,
    (payload) => completeInspection(id, payload),
  );
}
