"use client";

import { startInspection } from "@/services/api/inspection";
import type { InspectionSimpleWorkflowPayload } from "@/types/inspection";

import { useInspectionWorkflowMutation } from "./use-inspection-workflow-mutation";

export function useStartInspection(id: string) {
  return useInspectionWorkflowMutation<InspectionSimpleWorkflowPayload | undefined>(
    id,
    (payload) => startInspection(id, payload),
  );
}
