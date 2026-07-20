"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { myRequestsQueryKeys } from "@/lib/my-requests/query-keys";
import { getMyRequestWorkflowInvalidationKeys } from "@/lib/my-requests/workflow";
import {
  acknowledgeMyRequest,
  cancelMyRequest,
  createMyRequest,
  getMyRequest,
  getMyRequestOptions,
  getMyRequests,
  reopenMyRequest,
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

async function invalidateWorkflowCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
) {
  await Promise.all(
    getMyRequestWorkflowInvalidationKeys(id).map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
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

export function useCancelMyRequest(id: string) {
  const queryClient = useQueryClient();
  const enabled = useMyRequestsQueryEnabled("fm_tickets.view");

  return useMutation({
    mutationFn: (reason: string) => {
      if (!enabled) {
        return Promise.reject(new Error("Request cancellation is not available."));
      }
      return cancelMyRequest(id, reason);
    },
    onSuccess: async () => {
      await invalidateWorkflowCaches(queryClient, id);
    },
  });
}

export function useAcknowledgeMyRequest(id: string) {
  const queryClient = useQueryClient();
  const enabled = useMyRequestsQueryEnabled("fm_tickets.view");

  return useMutation({
    mutationFn: () => {
      if (!enabled) {
        return Promise.reject(new Error("Request acknowledgement is not available."));
      }
      return acknowledgeMyRequest(id);
    },
    onSuccess: async () => {
      await invalidateWorkflowCaches(queryClient, id);
    },
  });
}

export function useReopenMyRequest(id: string) {
  const queryClient = useQueryClient();
  const enabled = useMyRequestsQueryEnabled("fm_tickets.view");

  return useMutation({
    mutationFn: (reason: string) => {
      if (!enabled) {
        return Promise.reject(new Error("Request reopen is not available."));
      }
      return reopenMyRequest(id, reason);
    },
    onSuccess: async () => {
      await invalidateWorkflowCaches(queryClient, id);
    },
  });
}
