"use client";

import { updateInspectionFinding } from "@/services/api/inspection";
import type { InspectionFindingUpdatePayload } from "@/types/inspection";

import { useInspectionRecordMutation } from "./use-inspection-record-mutation";

export function useUpdateInspectionFinding(inspectionId: string, id: string) {
  return useInspectionRecordMutation<
    InspectionFindingUpdatePayload,
    unknown
  >(inspectionId, (payload) => updateInspectionFinding(id, payload));
}
