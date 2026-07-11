"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { inspectionQueryKeys } from "@/services/api/query-keys";

export function useInspectionRecordMutation<TPayload, TResult>(
  inspectionId: string,
  mutationFn: (payload: TPayload) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: inspectionQueryKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: inspectionQueryKeys.detail(inspectionId),
        }),
        queryClient.invalidateQueries({
          queryKey: inspectionQueryKeys.findings(inspectionId),
        }),
        queryClient.invalidateQueries({
          queryKey: inspectionQueryKeys.correctiveActions(inspectionId),
        }),
      ]);
    },
  });
}
