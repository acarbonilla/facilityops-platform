"use client";

import { deleteInspectionCorrectiveAction } from "@/services/api/inspection";

import { useInspectionRecordMutation } from "./use-inspection-record-mutation";

export function useDeleteInspectionCorrectiveAction(
  inspectionId: string,
  id: string,
) {
  return useInspectionRecordMutation<void, void>(inspectionId, () =>
    deleteInspectionCorrectiveAction(id),
  );
}
