"use client";

import { createInspectionCorrectiveAction } from "@/services/api/inspection";
import type { InspectionCorrectiveActionCreatePayload } from "@/types/inspection";

import { useInspectionRecordMutation } from "./use-inspection-record-mutation";

export function useCreateInspectionCorrectiveAction(inspectionId: string) {
  return useInspectionRecordMutation<
    InspectionCorrectiveActionCreatePayload,
    unknown
  >(inspectionId, (payload) => createInspectionCorrectiveAction(payload));
}
