"use client";

import { deleteInspectionFinding } from "@/services/api/inspection";

import { useInspectionRecordMutation } from "./use-inspection-record-mutation";

export function useDeleteInspectionFinding(inspectionId: string, id: string) {
  return useInspectionRecordMutation<void, void>(inspectionId, () =>
    deleteInspectionFinding(id),
  );
}
