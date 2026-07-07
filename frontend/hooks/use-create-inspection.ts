"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createInspection } from "@/services/api/inspection";
import { inspectionQueryKeys } from "@/services/api/query-keys";
import type { InspectionCreatePayload } from "@/types/inspection";

export function useCreateInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: InspectionCreatePayload) => createInspection(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: inspectionQueryKeys.all,
      });
    },
  });
}
