"use client";

import { assignInspection } from "@/services/api/inspection";
import type { InspectionAssignPayload } from "@/types/inspection";

import { useInspectionWorkflowMutation } from "./use-inspection-workflow-mutation";

export function useAssignInspection(id: string) {
  return useInspectionWorkflowMutation<InspectionAssignPayload>(id, (payload) =>
    assignInspection(id, payload),
  );
}
