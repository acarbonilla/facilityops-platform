"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getOrganizations, getTenants } from "@/services/api/master-data";
import { usersQueryKeys } from "@/services/api/query-keys";
import {
  createUser,
  deactivateUser,
  getUser,
  getUserDirectory,
  getUserRoleAssignments,
  getUsers,
  replaceUserRoleAssignments,
  updateUser,
} from "@/services/api/users";
import type {
  ReplaceUserRolesPayload,
  UserCreatePayload,
  UserDirectoryParams,
  UserListParams,
  UserRoleAssignmentResponse,
  UserUpdatePayload,
} from "@/types/users";

export function useUsers(params?: UserListParams) {
  return useQuery({
    queryKey: usersQueryKeys.list(params),
    queryFn: () => getUsers(params),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: usersQueryKeys.detail(id),
    queryFn: () => getUser(id),
    enabled: Boolean(id),
  });
}

export function useUserDirectory(params?: UserDirectoryParams, enabled = true) {
  return useQuery({
    queryKey: usersQueryKeys.directory(params),
    queryFn: () => getUserDirectory(params),
    enabled,
  });
}

export function useUserRoleAssignments(id: string, enabled = true) {
  return useQuery({
    queryKey: usersQueryKeys.roles(id),
    queryFn: () => getUserRoleAssignments(id),
    enabled: Boolean(id) && enabled,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserCreatePayload) => createUser(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
    },
  });
}

export function useUpdateUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserUpdatePayload) => updateUser(id, payload),
    onSuccess: async (user) => {
      queryClient.setQueryData(usersQueryKeys.detail(id), user);
      await queryClient.invalidateQueries({
        queryKey: usersQueryKeys.detail(id),
      });
      await queryClient.invalidateQueries({ queryKey: usersQueryKeys.lists() });
      await queryClient.invalidateQueries({
        queryKey: usersQueryKeys.directory(),
      });
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: async (_, id) => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
      await queryClient.invalidateQueries({
        queryKey: usersQueryKeys.detail(id),
      });
    },
  });
}

export function useReplaceUserRoleAssignments(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReplaceUserRolesPayload) =>
      replaceUserRoleAssignments(id, payload),
    onSuccess: async (response: UserRoleAssignmentResponse) => {
      queryClient.setQueryData(usersQueryKeys.roles(id), response);
      await queryClient.invalidateQueries({
        queryKey: usersQueryKeys.roles(id),
      });
    },
  });
}

export function useUserFormOptions() {
  return useQuery({
    queryKey: usersQueryKeys.formOptions(),
    queryFn: async () => {
      const [tenants, organizations] = await Promise.allSettled([
        getTenants({ page_size: 100 }),
        getOrganizations({ page_size: 100 }),
      ]);
      return {
        tenants: tenants.status === "fulfilled" ? tenants.value.results : [],
        organizations:
          organizations.status === "fulfilled"
            ? organizations.value.results
            : [],
      };
    },
  });
}
