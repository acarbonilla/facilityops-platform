"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { myRequestsQueryKeys } from "@/lib/my-requests/query-keys";
import {
  createMyRequest,
  getMyRequest,
  getMyRequestOptions,
  getMyRequests,
} from "@/services/api/fm-tickets";
import type {
  MyRequestCreatePayload,
  MyRequestListParams,
} from "@/types/my-requests";

function useMyRequestsQueryEnabled(requiredPermission: "fm_tickets.view" | "fm_tickets.create") {
  const { isAuthenticated, isLoading } = useAuth();
  const {
    hasPermission,
    isEmployeeRequesterMode,
    permissionsError,
    permissionsLoading,
  } = usePermissions();

  return (
    !isLoading &&
    isAuthenticated &&
    !permissionsLoading &&
    !permissionsError &&
    isEmployeeRequesterMode &&
    hasPermission(requiredPermission)
  );
}

export function useMyRequestList(params?: MyRequestListParams) {
  const enabled = useMyRequestsQueryEnabled("fm_tickets.view");

  return useQuery({
    queryKey: myRequestsQueryKeys.myRequestList(params),
    queryFn: () => getMyRequests(params),
    enabled,
  });
}

export function useMyRequestDetail(id: string) {
  const enabled = useMyRequestsQueryEnabled("fm_tickets.view") && Boolean(id);

  return useQuery({
    queryKey: myRequestsQueryKeys.myRequestDetail(id),
    queryFn: () => getMyRequest(id),
    enabled,
  });
}

export function useMyRequestOptions() {
  const enabled = useMyRequestsQueryEnabled("fm_tickets.create");

  return useQuery({
    queryKey: myRequestsQueryKeys.myRequestOptions(),
    queryFn: () => getMyRequestOptions(),
    enabled,
  });
}

export function useCreateMyRequest() {
  const queryClient = useQueryClient();
  const enabled = useMyRequestsQueryEnabled("fm_tickets.create");

  return useMutation({
    mutationFn: (payload: MyRequestCreatePayload) => {
      if (!enabled) {
        return Promise.reject(new Error("Request submission is not available."));
      }
      return createMyRequest(payload);
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({
        queryKey: myRequestsQueryKeys.myRequests(),
      });
      await queryClient.invalidateQueries({
        queryKey: myRequestsQueryKeys.myRequestDetail(created.id),
      });
      await queryClient.invalidateQueries({
        queryKey: myRequestsQueryKeys.myRequestOptions(),
      });
    },
  });
}
