"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  createProject,
  deleteProject,
  getProjectDetail,
  getProjectFormOptions,
  getProjectHistory,
  getProjectList,
  getProjectMetrics,
  updateProject,
} from "@/services/api/projects";
import { projectsQueryKeys } from "@/services/api/query-keys";
import {
  buildProjectFormDefaults,
  mapProjectDetailToFormValues,
} from "@/lib/projects/form";
import type {
  ProjectCreatePayload,
  ProjectDetail,
  ProjectFormValues,
  ProjectListParams,
  ProjectUpdatePayload,
} from "@/types/projects";

import { useAuth } from "./use-auth";

export function useProjectList(params?: ProjectListParams) {
  return useQuery({
    queryKey: projectsQueryKeys.list(params),
    queryFn: () => getProjectList(params),
  });
}

export function useProjectDetail(id: string) {
  return useQuery({
    queryKey: projectsQueryKeys.detail(id),
    queryFn: () => getProjectDetail(id),
    enabled: Boolean(id),
  });
}

export function useProjectMetrics(params?: ProjectListParams) {
  return useQuery({
    queryKey: projectsQueryKeys.metrics(params),
    queryFn: () => getProjectMetrics(params),
  });
}

export function useProjectHistory(id: string) {
  return useQuery({
    queryKey: projectsQueryKeys.history(id),
    queryFn: () => getProjectHistory(id),
    enabled: Boolean(id),
  });
}

export function useProjectFormOptions() {
  return useQuery({
    queryKey: projectsQueryKeys.formOptions(),
    queryFn: getProjectFormOptions,
  });
}

export function useProjectFormDefaults(
  detail?: ProjectDetail | null,
): ProjectFormValues {
  const { user } = useAuth();

  return useMemo(() => {
    if (detail) {
      return mapProjectDetailToFormValues(detail);
    }

    return buildProjectFormDefaults(user);
  }, [detail, user]);
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProjectCreatePayload) => createProject(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: projectsQueryKeys.all,
      });
    },
  });
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProjectUpdatePayload) => updateProject(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: projectsQueryKeys.all,
      });
      await queryClient.invalidateQueries({
        queryKey: projectsQueryKeys.detail(id),
      });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: projectsQueryKeys.all,
      });
    },
  });
}
