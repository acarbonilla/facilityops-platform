"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createRole,
  deactivateRole,
  getRole,
  getRolePermissions,
  getRoles,
  replaceRolePermissions,
  updateRole,
} from "@/services/api/rbac";
import { rbacQueryKeys } from "@/services/api/query-keys";
import type {
  ReplaceRolePermissionsPayload,
  RoleCreatePayload,
  RoleListParams,
  RoleUpdatePayload,
} from "@/types/rbac";

export function useRoles(params: RoleListParams) {
  return useQuery({
    queryKey: rbacQueryKeys.roles(params),
    queryFn: () => getRoles(params),
  });
}

export function useRole(id: string) {
  return useQuery({
    queryKey: rbacQueryKeys.role(id),
    queryFn: () => getRole(id),
    enabled: Boolean(id),
  });
}

export function useRolePermissions(id: string) {
  return useQuery({
    queryKey: rbacQueryKeys.rolePermissions(id),
    queryFn: () => getRolePermissions(id),
    enabled: Boolean(id),
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RoleCreatePayload) => createRole(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: rbacQueryKeys.roleLists(),
      });
    },
  });
}

export function useUpdateRole(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RoleUpdatePayload) => updateRole(id, payload),
    onSuccess: async (role) => {
      queryClient.setQueryData(rbacQueryKeys.role(id), role);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: rbacQueryKeys.roleLists() }),
        queryClient.invalidateQueries({ queryKey: rbacQueryKeys.role(id) }),
      ]);
    },
  });
}

export function useDeactivateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateRole(id),
    onSuccess: async (_, id) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: rbacQueryKeys.roleLists() }),
        queryClient.invalidateQueries({ queryKey: rbacQueryKeys.role(id) }),
        queryClient.invalidateQueries({
          queryKey: rbacQueryKeys.mePermissions(),
        }),
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "users" && query.queryKey[2] === "roles",
        }),
      ]);
    },
  });
}

export function useReplaceRolePermissions(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReplaceRolePermissionsPayload) =>
      replaceRolePermissions(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: rbacQueryKeys.rolePermissions(id),
        }),
        queryClient.invalidateQueries({ queryKey: rbacQueryKeys.role(id) }),
        queryClient.invalidateQueries({
          queryKey: rbacQueryKeys.mePermissions(),
        }),
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "users" && query.queryKey[2] === "roles",
        }),
      ]);
    },
  });
}
