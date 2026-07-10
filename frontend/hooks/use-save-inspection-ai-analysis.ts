"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { saveInspectionAIAnalysis } from "@/services/api/inspection";
import { inspectionQueryKeys } from "@/services/api/query-keys";
import type {
  InspectionAIAnalysis,
  InspectionAIAnalysisPayload,
} from "@/types/inspection";

export function useSaveInspectionAIAnalysis(inspectionId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    InspectionAIAnalysis,
    Error,
    InspectionAIAnalysisPayload
  >({
    mutationFn: (payload) => saveInspectionAIAnalysis(inspectionId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: inspectionQueryKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: inspectionQueryKeys.detail(inspectionId),
        }),
        queryClient.invalidateQueries({
          queryKey: inspectionQueryKeys.aiAnalysis(inspectionId),
        }),
        queryClient.invalidateQueries({
          queryKey: inspectionQueryKeys.history(inspectionId),
        }),
      ]);
    },
  });
}
