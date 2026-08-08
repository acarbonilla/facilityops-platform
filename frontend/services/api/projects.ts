import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";
import { getBuildings, getOrganizations } from "./master-data";

import type { PaginatedResponse } from "@/services/api/types";
import type { ProjectAssignmentOption } from "@/lib/projects/assignment-options";
import type {
  ProjectCreatePayload,
  ProjectDetail,
  ProjectFormOptions,
  ProjectGanttResponse,
  ProjectHistory,
  ProjectIssueComment,
  ProjectIssueCommentCreatePayload,
  ProjectIssueCreatePayload,
  ProjectIssueDetail,
  ProjectIssueListItem,
  ProjectIssueListParams,
  ProjectIssueUpdatePayload,
  ProjectLinkOption,
  ProjectLinkOptionParams,
  ProjectListItem,
  ProjectListParams,
  ProjectMember,
  ProjectMemberCreatePayload,
  ProjectMetrics,
  MyWorkDashboard,
  MyWorkAssignedTask,
  MyWorkListParams,
  ProjectNote,
  ProjectNoteCreatePayload,
  ProjectNoteListParams,
  ProjectNoteUpdatePayload,
  ProjectOperationalLink,
  ProjectOperationalLinkCreatePayload,
  ProjectOperationalLinkListParams,
  ProjectOperationalLinkUpdatePayload,
  ProjectProgressHistoryParams,
  ProjectProgressSnapshot,
  ProjectProgressSummary,
  ProjectTaskAssignPayload,
  ProjectTaskChecklistCreatePayload,
  ProjectTaskChecklistItem,
  ProjectTaskChecklistUpdatePayload,
  ProjectTaskComment,
  ProjectTaskCommentCreatePayload,
  ProjectTaskCreatePayload,
  ProjectTaskDependency,
  ProjectTaskDependencyCreatePayload,
  ProjectTaskDependencyReadiness,
  ProjectTaskDetail,
  ProjectTaskListItem,
  ProjectTaskListParams,
  ProjectTaskReorderPayload,
  ProjectTaskSummary,
  ProjectTaskUpdatePayload,
  ProjectTimelineEntry,
  ProjectTimelineListParams,
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

export function getMyWorkDashboard(params?: {
  project?: string;
  status?: string;
  priority?: string;
}): Promise<MyWorkDashboard> {
  return apiClient<MyWorkDashboard>(API_ENDPOINTS.projects.myWork, {
    method: "GET",
    query: params,
  });
}

export function getMyWorkTaskList(
  params?: MyWorkListParams,
): Promise<PaginatedResponse<MyWorkAssignedTask>> {
  return apiClient<PaginatedResponse<MyWorkAssignedTask>>(
    API_ENDPOINTS.projects.myWorkTasks,
    {
      method: "GET",
      query: params,
    },
  );
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

export function getProjectTaskSummary(
  projectId: string,
): Promise<ProjectTaskSummary> {
  return apiClient<ProjectTaskSummary>(
    API_ENDPOINTS.projects.taskSummary(projectId),
    { method: "GET" },
  );
}

export function getProjectTaskList(
  projectId: string,
  params?: ProjectTaskListParams,
): Promise<PaginatedResponse<ProjectTaskListItem>> {
  return apiClient<PaginatedResponse<ProjectTaskListItem>>(
    API_ENDPOINTS.projects.tasks(projectId),
    {
      method: "GET",
      query: params,
    },
  );
}

export function getProjectTaskDetail(
  projectId: string,
  taskId: string,
): Promise<ProjectTaskDetail> {
  return apiClient<ProjectTaskDetail>(
    API_ENDPOINTS.projects.taskDetail(projectId, taskId),
    { method: "GET" },
  );
}

export function createProjectTask(
  projectId: string,
  payload: ProjectTaskCreatePayload,
): Promise<ProjectTaskDetail> {
  return apiClient<ProjectTaskDetail>(
    API_ENDPOINTS.projects.tasks(projectId),
    {
      method: "POST",
      body: payload,
    },
  );
}

export function updateProjectTask(
  projectId: string,
  taskId: string,
  payload: ProjectTaskUpdatePayload,
): Promise<ProjectTaskDetail> {
  return apiClient<ProjectTaskDetail>(
    API_ENDPOINTS.projects.taskDetail(projectId, taskId),
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export function deleteProjectTask(
  projectId: string,
  taskId: string,
): Promise<void> {
  return apiClient<void>(
    API_ENDPOINTS.projects.taskDetail(projectId, taskId),
    { method: "DELETE" },
  );
}

export function assignProjectTask(
  projectId: string,
  taskId: string,
  payload: ProjectTaskAssignPayload,
): Promise<ProjectTaskDetail> {
  return apiClient<ProjectTaskDetail>(
    API_ENDPOINTS.projects.taskAssign(projectId, taskId),
    {
      method: "POST",
      body: payload,
    },
  );
}

export function startProjectTask(
  projectId: string,
  taskId: string,
): Promise<ProjectTaskDetail> {
  return apiClient<ProjectTaskDetail>(
    API_ENDPOINTS.projects.taskStart(projectId, taskId),
    { method: "POST", body: {} },
  );
}

export function pauseProjectTask(
  projectId: string,
  taskId: string,
): Promise<ProjectTaskDetail> {
  return apiClient<ProjectTaskDetail>(
    API_ENDPOINTS.projects.taskPause(projectId, taskId),
    { method: "POST", body: {} },
  );
}

export function resumeProjectTask(
  projectId: string,
  taskId: string,
): Promise<ProjectTaskDetail> {
  return apiClient<ProjectTaskDetail>(
    API_ENDPOINTS.projects.taskResume(projectId, taskId),
    { method: "POST", body: {} },
  );
}

export function completeProjectTask(
  projectId: string,
  taskId: string,
  payload?: { actual_end?: string },
): Promise<ProjectTaskDetail> {
  return apiClient<ProjectTaskDetail>(
    API_ENDPOINTS.projects.taskComplete(projectId, taskId),
    { method: "POST", body: payload ?? {} },
  );
}

export function updateProjectTaskProgress(
  projectId: string,
  taskId: string,
  payload: { progress_percentage: string | number },
): Promise<ProjectTaskDetail> {
  return apiClient<ProjectTaskDetail>(
    API_ENDPOINTS.projects.taskProgress(projectId, taskId),
    { method: "POST", body: payload },
  );
}

export function reportProjectTaskBlocker(
  projectId: string,
  taskId: string,
  payload: {
    title: string;
    description?: string;
    severity?: string;
  },
): Promise<ProjectIssueDetail> {
  return apiClient<ProjectIssueDetail>(
    API_ENDPOINTS.projects.taskReportBlocker(projectId, taskId),
    { method: "POST", body: payload },
  );
}

export function reorderProjectTasks(
  projectId: string,
  payload: ProjectTaskReorderPayload,
): Promise<ProjectTaskListItem[]> {
  return apiClient<ProjectTaskListItem[]>(
    API_ENDPOINTS.projects.taskReorder(projectId),
    {
      method: "POST",
      body: payload,
    },
  );
}

export function getProjectTaskChecklist(
  projectId: string,
  taskId: string,
): Promise<ProjectTaskChecklistItem[]> {
  return apiClient<ProjectTaskChecklistItem[]>(
    API_ENDPOINTS.projects.taskChecklist(projectId, taskId),
    { method: "GET" },
  );
}

export function createProjectTaskChecklistItem(
  projectId: string,
  taskId: string,
  payload: ProjectTaskChecklistCreatePayload,
): Promise<ProjectTaskChecklistItem> {
  return apiClient<ProjectTaskChecklistItem>(
    API_ENDPOINTS.projects.taskChecklist(projectId, taskId),
    {
      method: "POST",
      body: payload,
    },
  );
}

export function updateProjectTaskChecklistItem(
  projectId: string,
  taskId: string,
  itemId: string,
  payload: ProjectTaskChecklistUpdatePayload,
): Promise<ProjectTaskChecklistItem> {
  return apiClient<ProjectTaskChecklistItem>(
    API_ENDPOINTS.projects.taskChecklistItem(projectId, taskId, itemId),
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export function deleteProjectTaskChecklistItem(
  projectId: string,
  taskId: string,
  itemId: string,
): Promise<void> {
  return apiClient<void>(
    API_ENDPOINTS.projects.taskChecklistItem(projectId, taskId, itemId),
    { method: "DELETE" },
  );
}

export function getProjectTaskComments(
  projectId: string,
  taskId: string,
  params?: { page?: number; page_size?: number },
): Promise<PaginatedResponse<ProjectTaskComment>> {
  return apiClient<PaginatedResponse<ProjectTaskComment>>(
    API_ENDPOINTS.projects.taskComments(projectId, taskId),
    {
      method: "GET",
      query: params,
    },
  );
}

export function createProjectTaskComment(
  projectId: string,
  taskId: string,
  payload: ProjectTaskCommentCreatePayload,
): Promise<ProjectTaskComment> {
  return apiClient<ProjectTaskComment>(
    API_ENDPOINTS.projects.taskComments(projectId, taskId),
    {
      method: "POST",
      body: payload,
    },
  );
}

export function deleteProjectTaskComment(
  projectId: string,
  taskId: string,
  commentId: string,
): Promise<void> {
  return apiClient<void>(
    API_ENDPOINTS.projects.taskComment(projectId, taskId, commentId),
    { method: "DELETE" },
  );
}

export function getProjectGantt(
  projectId: string,
): Promise<ProjectGanttResponse> {
  return apiClient<ProjectGanttResponse>(
    API_ENDPOINTS.projects.gantt(projectId),
    { method: "GET" },
  );
}

export function getProjectDependencies(
  projectId: string,
  params?: { page?: number; page_size?: number },
): Promise<PaginatedResponse<ProjectTaskDependency> | ProjectTaskDependency[]> {
  return apiClient<
    PaginatedResponse<ProjectTaskDependency> | ProjectTaskDependency[]
  >(API_ENDPOINTS.projects.dependencies(projectId), {
    method: "GET",
    query: params,
  });
}

export function getProjectDependency(
  projectId: string,
  dependencyId: string,
): Promise<ProjectTaskDependency> {
  return apiClient<ProjectTaskDependency>(
    API_ENDPOINTS.projects.dependency(projectId, dependencyId),
    { method: "GET" },
  );
}

export function createProjectDependency(
  projectId: string,
  payload: ProjectTaskDependencyCreatePayload,
): Promise<ProjectTaskDependency> {
  return apiClient<ProjectTaskDependency>(
    API_ENDPOINTS.projects.dependencies(projectId),
    {
      method: "POST",
      body: payload,
    },
  );
}

export function deleteProjectDependency(
  projectId: string,
  dependencyId: string,
): Promise<void> {
  return apiClient<void>(
    API_ENDPOINTS.projects.dependency(projectId, dependencyId),
    { method: "DELETE" },
  );
}

export function getProjectTaskPredecessors(
  projectId: string,
  taskId: string,
): Promise<ProjectTaskDependency[]> {
  return apiClient<ProjectTaskDependency[]>(
    API_ENDPOINTS.projects.taskPredecessors(projectId, taskId),
    { method: "GET" },
  );
}

export function getProjectTaskSuccessors(
  projectId: string,
  taskId: string,
): Promise<ProjectTaskDependency[]> {
  return apiClient<ProjectTaskDependency[]>(
    API_ENDPOINTS.projects.taskSuccessors(projectId, taskId),
    { method: "GET" },
  );
}

export function getProjectTaskDependencyReadiness(
  projectId: string,
  taskId: string,
): Promise<ProjectTaskDependencyReadiness> {
  return apiClient<ProjectTaskDependencyReadiness>(
    API_ENDPOINTS.projects.taskDependencyReadiness(projectId, taskId),
    { method: "GET" },
  );
}

export function getProjectTimeline(
  projectId: string,
  params?: ProjectTimelineListParams,
): Promise<PaginatedResponse<ProjectTimelineEntry>> {
  return apiClient<PaginatedResponse<ProjectTimelineEntry>>(
    API_ENDPOINTS.projects.timeline(projectId),
    {
      method: "GET",
      query: params,
    },
  );
}

export function getProjectProgress(
  projectId: string,
): Promise<ProjectProgressSummary> {
  return apiClient<ProjectProgressSummary>(
    API_ENDPOINTS.projects.progress(projectId),
    { method: "GET" },
  );
}

export function getProjectProgressHistory(
  projectId: string,
  params?: ProjectProgressHistoryParams,
): Promise<PaginatedResponse<ProjectProgressSnapshot>> {
  return apiClient<PaginatedResponse<ProjectProgressSnapshot>>(
    API_ENDPOINTS.projects.progressHistory(projectId),
    {
      method: "GET",
      query: params,
    },
  );
}

export function recalculateProjectProgress(
  projectId: string,
): Promise<ProjectProgressSummary> {
  return apiClient<ProjectProgressSummary>(
    API_ENDPOINTS.projects.recalculateProgress(projectId),
    { method: "POST", body: {} },
  );
}

export function getProjectNoteList(
  projectId: string,
  params?: ProjectNoteListParams,
): Promise<PaginatedResponse<ProjectNote>> {
  return apiClient<PaginatedResponse<ProjectNote>>(
    API_ENDPOINTS.projects.notes(projectId),
    {
      method: "GET",
      query: params,
    },
  );
}

export function getProjectNoteDetail(
  projectId: string,
  noteId: string,
): Promise<ProjectNote> {
  return apiClient<ProjectNote>(
    API_ENDPOINTS.projects.noteDetail(projectId, noteId),
    { method: "GET" },
  );
}

export function createProjectNote(
  projectId: string,
  payload: ProjectNoteCreatePayload,
): Promise<ProjectNote> {
  return apiClient<ProjectNote>(API_ENDPOINTS.projects.notes(projectId), {
    method: "POST",
    body: payload,
  });
}

export function updateProjectNote(
  projectId: string,
  noteId: string,
  payload: ProjectNoteUpdatePayload,
): Promise<ProjectNote> {
  return apiClient<ProjectNote>(
    API_ENDPOINTS.projects.noteDetail(projectId, noteId),
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export function deleteProjectNote(
  projectId: string,
  noteId: string,
): Promise<void> {
  return apiClient<void>(
    API_ENDPOINTS.projects.noteDetail(projectId, noteId),
    { method: "DELETE" },
  );
}

export function getProjectIssueList(
  projectId: string,
  params?: ProjectIssueListParams,
): Promise<PaginatedResponse<ProjectIssueListItem>> {
  return apiClient<PaginatedResponse<ProjectIssueListItem>>(
    API_ENDPOINTS.projects.issues(projectId),
    {
      method: "GET",
      query: params,
    },
  );
}

export function getProjectIssueDetail(
  projectId: string,
  issueId: string,
): Promise<ProjectIssueDetail> {
  return apiClient<ProjectIssueDetail>(
    API_ENDPOINTS.projects.issueDetail(projectId, issueId),
    { method: "GET" },
  );
}

export function createProjectIssue(
  projectId: string,
  payload: ProjectIssueCreatePayload,
): Promise<ProjectIssueDetail> {
  return apiClient<ProjectIssueDetail>(
    API_ENDPOINTS.projects.issues(projectId),
    {
      method: "POST",
      body: payload,
    },
  );
}

export function updateProjectIssue(
  projectId: string,
  issueId: string,
  payload: ProjectIssueUpdatePayload,
): Promise<ProjectIssueDetail> {
  return apiClient<ProjectIssueDetail>(
    API_ENDPOINTS.projects.issueDetail(projectId, issueId),
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export function deleteProjectIssue(
  projectId: string,
  issueId: string,
): Promise<void> {
  return apiClient<void>(
    API_ENDPOINTS.projects.issueDetail(projectId, issueId),
    { method: "DELETE" },
  );
}

export function getProjectIssueComments(
  projectId: string,
  issueId: string,
  params?: { page?: number; page_size?: number },
): Promise<PaginatedResponse<ProjectIssueComment>> {
  return apiClient<PaginatedResponse<ProjectIssueComment>>(
    API_ENDPOINTS.projects.issueComments(projectId, issueId),
    {
      method: "GET",
      query: params,
    },
  );
}

export function createProjectIssueComment(
  projectId: string,
  issueId: string,
  payload: ProjectIssueCommentCreatePayload,
): Promise<ProjectIssueComment> {
  return apiClient<ProjectIssueComment>(
    API_ENDPOINTS.projects.issueComments(projectId, issueId),
    {
      method: "POST",
      body: payload,
    },
  );
}

export function deleteProjectIssueComment(
  projectId: string,
  issueId: string,
  commentId: string,
): Promise<void> {
  return apiClient<void>(
    API_ENDPOINTS.projects.issueComment(projectId, issueId, commentId),
    { method: "DELETE" },
  );
}

export function getProjectLinkList(
  projectId: string,
  params?: ProjectOperationalLinkListParams,
): Promise<PaginatedResponse<ProjectOperationalLink>> {
  return apiClient<PaginatedResponse<ProjectOperationalLink>>(
    API_ENDPOINTS.projects.links(projectId),
    {
      method: "GET",
      query: params,
    },
  );
}

export function getProjectLinkDetail(
  projectId: string,
  linkId: string,
): Promise<ProjectOperationalLink> {
  return apiClient<ProjectOperationalLink>(
    API_ENDPOINTS.projects.linkDetail(projectId, linkId),
    { method: "GET" },
  );
}

export function createProjectLink(
  projectId: string,
  payload: ProjectOperationalLinkCreatePayload,
): Promise<ProjectOperationalLink> {
  return apiClient<ProjectOperationalLink>(
    API_ENDPOINTS.projects.links(projectId),
    {
      method: "POST",
      body: payload,
    },
  );
}

export function updateProjectLink(
  projectId: string,
  linkId: string,
  payload: ProjectOperationalLinkUpdatePayload,
): Promise<ProjectOperationalLink> {
  return apiClient<ProjectOperationalLink>(
    API_ENDPOINTS.projects.linkDetail(projectId, linkId),
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export function deleteProjectLink(
  projectId: string,
  linkId: string,
): Promise<void> {
  return apiClient<void>(
    API_ENDPOINTS.projects.linkDetail(projectId, linkId),
    { method: "DELETE" },
  );
}

export function getProjectLinkOptions(
  projectId: string,
  params: ProjectLinkOptionParams,
): Promise<PaginatedResponse<ProjectLinkOption>> {
  return apiClient<PaginatedResponse<ProjectLinkOption>>(
    API_ENDPOINTS.projects.linkOptions(projectId),
    {
      method: "GET",
      query: params,
    },
  );
}

export function getProjectManagerAssignmentOptions(params?: {
  search?: string;
  tenant?: string;
  page_size?: number;
}): Promise<{ count: number; results: ProjectAssignmentOption[] }> {
  return apiClient<{ count: number; results: ProjectAssignmentOption[] }>(
    API_ENDPOINTS.projects.projectManagerOptions,
    {
      method: "GET",
      query: params,
    },
  );
}

export function getProjectTaskPicAssignmentOptions(
  projectId: string,
  params?: { search?: string; page_size?: number },
): Promise<{ count: number; results: ProjectAssignmentOption[] }> {
  return apiClient<{ count: number; results: ProjectAssignmentOption[] }>(
    API_ENDPOINTS.projects.taskPicOptions(projectId),
    {
      method: "GET",
      query: params,
    },
  );
}
