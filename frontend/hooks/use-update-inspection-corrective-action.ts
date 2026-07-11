"use client";

import { updateInspectionCorrectiveAction } from "@/services/api/inspection";
import type { InspectionCorrectiveActionUpdatePayload } from "@/types/inspection";

import { useInspectionRecordMutation } from "./use-inspection-record-mutation";

export function useUpdateInspectionCorrectiveAction(
  inspectionId: string,
  id: string,
) {
  return useInspectionRecordMutation<
    InspectionCorrectiveActionUpdatePayload,
    unknown
  >(inspectionId, (payload) => updateInspectionCorrectiveAction(id, payload));
}
