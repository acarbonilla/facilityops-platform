"use client";

import { verifyInspection } from "@/services/api/inspection";
import type { InspectionSimpleWorkflowPayload } from "@/types/inspection";

import { useInspectionWorkflowMutation } from "./use-inspection-workflow-mutation";

export function useVerifyInspection(id: string) {
  return useInspectionWorkflowMutation<InspectionSimpleWorkflowPayload | undefined>(
    id,
    (payload) => verifyInspection(id, payload),
  );
}
