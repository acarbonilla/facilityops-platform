import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";
import { getBuildings, getOrganizations } from "./master-data";

import type { PaginatedResponse } from "@/services/api/types";
import type {
  ProjectCreatePayload,
  ProjectDetail,
  ProjectFormOptions,
  ProjectHistory,
  ProjectListItem,
  ProjectListParams,
  ProjectMember,
  ProjectMemberCreatePayload,
  ProjectMetrics,
  ProjectUpdatePayload,
} from "@/types/projects";

export function getProjectList(
  params?: ProjectListParams,
): Promise<PaginatedResponse<ProjectListItem>> {
  return apiClient<PaginatedResponse<ProjectListItem>>(
    API_ENDPOINTS.projects.list,
    {
      method: "GET",
      query: params,
    },
  );
}

export function getProjectDetail(id: string): Promise<ProjectDetail> {
  return apiClient<ProjectDetail>(API_ENDPOINTS.projects.detail(id), {
    method: "GET",
  });
}

export function getProjectMetrics(
  params?: ProjectListParams,
): Promise<ProjectMetrics> {
  return apiClient<ProjectMetrics>(API_ENDPOINTS.projects.metrics, {
    method: "GET",
    query: params,
  });
}

export function createProject(
  payload: ProjectCreatePayload,
): Promise<ProjectDetail> {
  return apiClient<ProjectDetail>(API_ENDPOINTS.projects.list, {
    method: "POST",
    body: payload,
  });
}

export function updateProject(
  id: string,
  payload: ProjectUpdatePayload,
): Promise<ProjectDetail> {
  return apiClient<ProjectDetail>(API_ENDPOINTS.projects.detail(id), {
    method: "PATCH",
    body: payload,
  });
}

export function deleteProject(id: string): Promise<void> {
  return apiClient<void>(API_ENDPOINTS.projects.detail(id), {
    method: "DELETE",
  });
}

export function getProjectHistory(
  id: string,
  params?: { page?: number; page_size?: number },
): Promise<PaginatedResponse<ProjectHistory>> {
  return apiClient<PaginatedResponse<ProjectHistory>>(
    API_ENDPOINTS.projects.history(id),
    {
      method: "GET",
      query: params,
    },
  );
}

export function getProjectMembers(
  id: string,
  params?: { page?: number; page_size?: number },
): Promise<PaginatedResponse<ProjectMember>> {
  return apiClient<PaginatedResponse<ProjectMember>>(
    API_ENDPOINTS.projects.members(id),
    {
      method: "GET",
      query: params,
    },
  );
}

export function addProjectMember(
  id: string,
  payload: ProjectMemberCreatePayload,
): Promise<ProjectMember> {
  return apiClient<ProjectMember>(API_ENDPOINTS.projects.members(id), {
    method: "POST",
    body: payload,
  });
}

export function removeProjectMember(
  projectId: string,
  memberId: string,
): Promise<void> {
  return apiClient<void>(
    API_ENDPOINTS.projects.member(projectId, memberId),
    {
      method: "DELETE",
    },
  );
}

export async function getProjectFormOptions(): Promise<ProjectFormOptions> {
  const [organizationsResponse, buildingsResponse] = await Promise.all([
    getOrganizations({ page_size: 100 }),
    getBuildings({ page_size: 100 }),
  ]);

  return {
    organizations: organizationsResponse.results,
    buildings: buildingsResponse.results,
    supports_user_directory: true,
    user_directory_note: null,
  };
}
