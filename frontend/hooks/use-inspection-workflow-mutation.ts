"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { inspectionQueryKeys } from "@/services/api/query-keys";

export function useInspectionWorkflowMutation<TPayload>(
  id: string,
  mutationFn: (payload: TPayload) => Promise<unknown>,
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
          queryKey: inspectionQueryKeys.detail(id),
        }),
        queryClient.invalidateQueries({
          queryKey: inspectionQueryKeys.history(id),
        }),
      ]);
    },
  });
}
