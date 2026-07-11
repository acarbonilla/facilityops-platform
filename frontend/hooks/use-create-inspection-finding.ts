"use client";

import { createInspectionFinding } from "@/services/api/inspection";
import type { InspectionFindingCreatePayload } from "@/types/inspection";

import { useInspectionRecordMutation } from "./use-inspection-record-mutation";

export function useCreateInspectionFinding(inspectionId: string) {
  return useInspectionRecordMutation<
    InspectionFindingCreatePayload,
    unknown
  >(inspectionId, (payload) => createInspectionFinding(payload));
}
