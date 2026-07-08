"use client";

import { reopenInspection } from "@/services/api/inspection";
import type { InspectionReopenPayload } from "@/types/inspection";

import { useInspectionWorkflowMutation } from "./use-inspection-workflow-mutation";

export function useReopenInspection(id: string) {
  return useInspectionWorkflowMutation<InspectionReopenPayload>(id, (payload) =>
    reopenInspection(id, payload),
  );
}
