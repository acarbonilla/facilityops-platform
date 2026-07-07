"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateInspection } from "@/services/api/inspection";
import { inspectionQueryKeys } from "@/services/api/query-keys";
import type { InspectionUpdatePayload } from "@/types/inspection";

export function useUpdateInspection(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: InspectionUpdatePayload) => updateInspection(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: inspectionQueryKeys.all,
      });
      await queryClient.invalidateQueries({
        queryKey: inspectionQueryKeys.detail(id),
      });
    },
  });
}
