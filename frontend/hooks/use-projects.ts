"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  assignProjectTask,
  createProject,
  createProjectDependency,
  createProjectIssue,
  createProjectIssueComment,
  createProjectNote,
  createProjectTask,
  createProjectTaskChecklistItem,
  createProjectTaskComment,
  deleteProject,
  deleteProjectDependency,
  deleteProjectIssue,
  deleteProjectIssueComment,
  deleteProjectNote,
  deleteProjectTask,
  deleteProjectTaskChecklistItem,
  deleteProjectTaskComment,
  getProjectDependencies,
  getProjectDetail,
  getProjectFormOptions,
  getProjectGantt,
  getProjectHistory,
  getProjectIssueComments,
  getProjectIssueDetail,
  getProjectIssueList,
  getProjectList,
  getProjectMembers,
  getProjectMetrics,
  getProjectNoteDetail,
  getProjectNoteList,
  getProjectProgress,
  getProjectProgressHistory,
  getProjectTaskChecklist,
  getProjectTaskComments,
  getProjectTaskDependencyReadiness,
  getProjectTaskDetail,
  getProjectTaskList,
  getProjectTaskPredecessors,
  getProjectTaskSuccessors,
  getProjectTaskSummary,
  getProjectTimeline,
  recalculateProjectProgress,
  reorderProjectTasks,
  updateProject,
  updateProjectIssue,
  updateProjectNote,
  updateProjectTask,
  updateProjectTaskChecklistItem,
} from "@/services/api/projects";
import { projectsQueryKeys } from "@/services/api/query-keys";
import {
  buildProjectFormDefaults,
  mapProjectDetailToFormValues,
} from "@/lib/projects/form";
import {
  buildProjectIssueFormDefaults,
  mapProjectIssueDetailToFormValues,
} from "@/lib/projects/issues-form";
import {
  buildProjectNoteFormDefaults,
  mapProjectNoteDetailToFormValues,
} from "@/lib/projects/notes-form";
import {
  buildProjectTaskFormDefaults,
  mapProjectTaskDetailToFormValues,
} from "@/lib/projects/tasks-form";
import type {
  ProjectCreatePayload,
  ProjectDetail,
  ProjectFormValues,
  ProjectIssueCommentCreatePayload,
  ProjectIssueCreatePayload,
  ProjectIssueDetail,
  ProjectIssueFormValues,
  ProjectIssueListParams,
  ProjectIssueUpdatePayload,
  ProjectListParams,
  ProjectNote,
  ProjectNoteCreatePayload,
  ProjectNoteListParams,
  ProjectNoteUpdatePayload,
  ProjectProgressHistoryParams,
  ProjectTaskAssignPayload,
  ProjectTaskChecklistCreatePayload,
  ProjectTaskChecklistUpdatePayload,
  ProjectTaskCommentCreatePayload,
  ProjectTaskCreatePayload,
  ProjectTaskDependencyCreatePayload,
  ProjectTaskDetail,
  ProjectTaskFormValues,
  ProjectTaskListParams,
  ProjectTaskReorderPayload,
  ProjectTaskUpdatePayload,
  ProjectTimelineListParams,
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

export function useProjectMembers(id: string) {
  return useQuery({
    queryKey: projectsQueryKeys.members(id),
    queryFn: () => getProjectMembers(id, { page_size: 100 }),
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

async function invalidateProjectTasks(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
  taskId?: string,
) {
  await queryClient.invalidateQueries({
    queryKey: projectsQueryKeys.tasks(projectId),
  });
  await queryClient.invalidateQueries({
    queryKey: projectsQueryKeys.detail(projectId),
  });
  await queryClient.invalidateQueries({
    queryKey: projectsQueryKeys.taskSummary(projectId),
  });
  await queryClient.invalidateQueries({
    queryKey: projectsQueryKeys.history(projectId),
  });
  await queryClient.invalidateQueries({
    queryKey: projectsQueryKeys.gantt(projectId),
  });
  await queryClient.invalidateQueries({
    queryKey: projectsQueryKeys.dependencies(projectId),
  });
  await queryClient.invalidateQueries({
    queryKey: projectsQueryKeys.progress(projectId),
  });
  await queryClient.invalidateQueries({
    queryKey: ["projects", projectId, "progress-history"],
  });
  if (taskId) {
    await queryClient.invalidateQueries({
      queryKey: projectsQueryKeys.taskDetail(projectId, taskId),
    });
    await queryClient.invalidateQueries({
      queryKey: projectsQueryKeys.taskChecklist(projectId, taskId),
    });
    await queryClient.invalidateQueries({
      queryKey: projectsQueryKeys.taskComments(projectId, taskId),
    });
    await queryClient.invalidateQueries({
      queryKey: projectsQueryKeys.taskPredecessors(projectId, taskId),
    });
    await queryClient.invalidateQueries({
      queryKey: projectsQueryKeys.taskSuccessors(projectId, taskId),
    });
    await queryClient.invalidateQueries({
      queryKey: projectsQueryKeys.taskDependencyReadiness(projectId, taskId),
    });
  }
}

async function invalidateProjectDependencies(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
) {
  await queryClient.invalidateQueries({
    queryKey: projectsQueryKeys.gantt(projectId),
  });
  await queryClient.invalidateQueries({
    queryKey: projectsQueryKeys.dependencies(projectId),
  });
  await queryClient.invalidateQueries({
    queryKey: projectsQueryKeys.tasks(projectId),
  });
  await queryClient.invalidateQueries({
    queryKey: projectsQueryKeys.history(projectId),
  });
}

export function useProjectTaskSummary(projectId: string) {
  return useQuery({
    queryKey: projectsQueryKeys.taskSummary(projectId),
    queryFn: () => getProjectTaskSummary(projectId),
    enabled: Boolean(projectId),
  });
}

export function useProjectTaskList(
  projectId: string,
  params?: ProjectTaskListParams,
) {
  return useQuery({
    queryKey: projectsQueryKeys.taskList(projectId, params),
    queryFn: () => getProjectTaskList(projectId, params),
    enabled: Boolean(projectId),
  });
}

export function useProjectTaskDetail(projectId: string, taskId: string) {
  return useQuery({
    queryKey: projectsQueryKeys.taskDetail(projectId, taskId),
    queryFn: () => getProjectTaskDetail(projectId, taskId),
    enabled: Boolean(projectId) && Boolean(taskId),
  });
}

export function useProjectTaskFormDefaults(
  detail?: ProjectTaskDetail | null,
): ProjectTaskFormValues {
  return useMemo(() => {
    if (detail) {
      return mapProjectTaskDetailToFormValues(detail);
    }
    return buildProjectTaskFormDefaults();
  }, [detail]);
}

export function useCreateProjectTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProjectTaskCreatePayload) =>
      createProjectTask(projectId, payload),
    onSuccess: async () => {
      await invalidateProjectTasks(queryClient, projectId);
    },
  });
}

export function useUpdateProjectTask(projectId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProjectTaskUpdatePayload) =>
      updateProjectTask(projectId, taskId, payload),
    onSuccess: async () => {
      await invalidateProjectTasks(queryClient, projectId, taskId);
    },
  });
}

export function useDeleteProjectTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => deleteProjectTask(projectId, taskId),
    onSuccess: async (_data, taskId) => {
      await invalidateProjectTasks(queryClient, projectId, taskId);
    },
  });
}

export function useAssignProjectTask(projectId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProjectTaskAssignPayload) =>
      assignProjectTask(projectId, taskId, payload),
    onSuccess: async () => {
      await invalidateProjectTasks(queryClient, projectId, taskId);
    },
  });
}

export function useReorderProjectTasks(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProjectTaskReorderPayload) =>
      reorderProjectTasks(projectId, payload),
    onSuccess: async () => {
      await invalidateProjectTasks(queryClient, projectId);
    },
  });
}

export function useProjectTaskChecklist(projectId: string, taskId: string) {
  return useQuery({
    queryKey: projectsQueryKeys.taskChecklist(projectId, taskId),
    queryFn: () => getProjectTaskChecklist(projectId, taskId),
    enabled: Boolean(projectId) && Boolean(taskId),
  });
}

export function useCreateProjectTaskChecklistItem(
  projectId: string,
  taskId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProjectTaskChecklistCreatePayload) =>
      createProjectTaskChecklistItem(projectId, taskId, payload),
    onSuccess: async () => {
      await invalidateProjectTasks(queryClient, projectId, taskId);
    },
  });
}

export function useUpdateProjectTaskChecklistItem(
  projectId: string,
  taskId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      itemId,
      payload,
    }: {
      itemId: string;
      payload: ProjectTaskChecklistUpdatePayload;
    }) =>
      updateProjectTaskChecklistItem(projectId, taskId, itemId, payload),
    onSuccess: async () => {
      await invalidateProjectTasks(queryClient, projectId, taskId);
    },
  });
}

export function useDeleteProjectTaskChecklistItem(
  projectId: string,
  taskId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) =>
      deleteProjectTaskChecklistItem(projectId, taskId, itemId),
    onSuccess: async () => {
      await invalidateProjectTasks(queryClient, projectId, taskId);
    },
  });
}

export function useProjectTaskComments(projectId: string, taskId: string) {
  return useQuery({
    queryKey: projectsQueryKeys.taskComments(projectId, taskId),
    queryFn: () => getProjectTaskComments(projectId, taskId, { page_size: 100 }),
    enabled: Boolean(projectId) && Boolean(taskId),
  });
}

export function useCreateProjectTaskComment(
  projectId: string,
  taskId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProjectTaskCommentCreatePayload) =>
      createProjectTaskComment(projectId, taskId, payload),
    onSuccess: async () => {
      await invalidateProjectTasks(queryClient, projectId, taskId);
    },
  });
}

export function useDeleteProjectTaskComment(
  projectId: string,
  taskId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) =>
      deleteProjectTaskComment(projectId, taskId, commentId),
    onSuccess: async () => {
      await invalidateProjectTasks(queryClient, projectId, taskId);
    },
  });
}

export function useProjectGantt(projectId: string) {
  return useQuery({
    queryKey: projectsQueryKeys.gantt(projectId),
    queryFn: () => getProjectGantt(projectId),
    enabled: Boolean(projectId),
  });
}

export function useProjectDependencies(projectId: string) {
  return useQuery({
    queryKey: projectsQueryKeys.dependencies(projectId),
    queryFn: async () => {
      const response = await getProjectDependencies(projectId, {
        page_size: 200,
      });
      return Array.isArray(response) ? response : response.results;
    },
    enabled: Boolean(projectId),
  });
}

export function useCreateProjectDependency(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProjectTaskDependencyCreatePayload) =>
      createProjectDependency(projectId, payload),
    onSuccess: async () => {
      await invalidateProjectDependencies(queryClient, projectId);
    },
  });
}

export function useDeleteProjectDependency(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dependencyId: string) =>
      deleteProjectDependency(projectId, dependencyId),
    onSuccess: async () => {
      await invalidateProjectDependencies(queryClient, projectId);
    },
  });
}

export function useProjectTaskPredecessors(
  projectId: string,
  taskId: string,
) {
  return useQuery({
    queryKey: projectsQueryKeys.taskPredecessors(projectId, taskId),
    queryFn: () => getProjectTaskPredecessors(projectId, taskId),
    enabled: Boolean(projectId) && Boolean(taskId),
  });
}

export function useProjectTaskSuccessors(projectId: string, taskId: string) {
  return useQuery({
    queryKey: projectsQueryKeys.taskSuccessors(projectId, taskId),
    queryFn: () => getProjectTaskSuccessors(projectId, taskId),
    enabled: Boolean(projectId) && Boolean(taskId),
  });
}

export function useProjectTaskDependencyReadiness(
  projectId: string,
  taskId: string,
) {
  return useQuery({
    queryKey: projectsQueryKeys.taskDependencyReadiness(projectId, taskId),
    queryFn: () => getProjectTaskDependencyReadiness(projectId, taskId),
    enabled: Boolean(projectId) && Boolean(taskId),
  });
}

async function invalidateProjectNotes(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
  noteId?: string,
) {
  await queryClient.invalidateQueries({
    queryKey: projectsQueryKeys.notes(projectId),
  });
  await queryClient.invalidateQueries({
    queryKey: projectsQueryKeys.timeline(projectId),
  });
  await queryClient.invalidateQueries({
    queryKey: projectsQueryKeys.history(projectId),
  });
  if (noteId) {
    await queryClient.invalidateQueries({
      queryKey: projectsQueryKeys.noteDetail(projectId, noteId),
    });
  }
}

async function invalidateProjectIssues(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
  issueId?: string,
) {
  await queryClient.invalidateQueries({
    queryKey: projectsQueryKeys.issues(projectId),
  });
  await queryClient.invalidateQueries({
    queryKey: projectsQueryKeys.timeline(projectId),
  });
  await queryClient.invalidateQueries({
    queryKey: projectsQueryKeys.history(projectId),
  });
  if (issueId) {
    await queryClient.invalidateQueries({
      queryKey: projectsQueryKeys.issueDetail(projectId, issueId),
    });
    await queryClient.invalidateQueries({
      queryKey: projectsQueryKeys.issueComments(projectId, issueId),
    });
  }
}

export function useProjectTimeline(
  projectId: string,
  params?: ProjectTimelineListParams,
) {
  return useQuery({
    queryKey: projectsQueryKeys.timelineList(projectId, params),
    queryFn: () => getProjectTimeline(projectId, params),
    enabled: Boolean(projectId),
  });
}

export function useProjectProgress(projectId: string) {
  return useQuery({
    queryKey: projectsQueryKeys.progress(projectId),
    queryFn: () => getProjectProgress(projectId),
    enabled: Boolean(projectId),
  });
}

export function useProjectProgressHistory(
  projectId: string,
  params?: ProjectProgressHistoryParams,
) {
  return useQuery({
    queryKey: projectsQueryKeys.progressHistory(projectId, params),
    queryFn: () => getProjectProgressHistory(projectId, params),
    enabled: Boolean(projectId),
  });
}

export function useRecalculateProjectProgress(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => recalculateProjectProgress(projectId),
    onSuccess: async (summary) => {
      queryClient.setQueryData(
        projectsQueryKeys.progress(projectId),
        summary,
      );
      await queryClient.invalidateQueries({
        queryKey: projectsQueryKeys.progress(projectId),
      });
      await queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "progress-history"],
      });
      await queryClient.invalidateQueries({
        queryKey: projectsQueryKeys.detail(projectId),
      });
      await queryClient.invalidateQueries({
        queryKey: projectsQueryKeys.list(),
      });
    },
  });
}

export function useProjectNoteList(
  projectId: string,
  params?: ProjectNoteListParams,
) {
  return useQuery({
    queryKey: projectsQueryKeys.noteList(projectId, params),
    queryFn: () => getProjectNoteList(projectId, params),
    enabled: Boolean(projectId),
  });
}

export function useProjectNoteDetail(projectId: string, noteId: string) {
  return useQuery({
    queryKey: projectsQueryKeys.noteDetail(projectId, noteId),
    queryFn: () => getProjectNoteDetail(projectId, noteId),
    enabled: Boolean(projectId) && Boolean(noteId),
  });
}

export function useProjectNoteFormDefaults(detail?: ProjectNote | null) {
  return useMemo(() => {
    if (detail) {
      return mapProjectNoteDetailToFormValues(detail);
    }
    return buildProjectNoteFormDefaults();
  }, [detail]);
}

export function useCreateProjectNote(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProjectNoteCreatePayload) =>
      createProjectNote(projectId, payload),
    onSuccess: async () => {
      await invalidateProjectNotes(queryClient, projectId);
    },
  });
}

export function useUpdateProjectNote(projectId: string, noteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProjectNoteUpdatePayload) =>
      updateProjectNote(projectId, noteId, payload),
    onSuccess: async () => {
      await invalidateProjectNotes(queryClient, projectId, noteId);
    },
  });
}

export function useDeleteProjectNote(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) => deleteProjectNote(projectId, noteId),
    onSuccess: async (_data, noteId) => {
      await invalidateProjectNotes(queryClient, projectId, noteId);
    },
  });
}

export function useProjectIssueList(
  projectId: string,
  params?: ProjectIssueListParams,
) {
  return useQuery({
    queryKey: projectsQueryKeys.issueList(projectId, params),
    queryFn: () => getProjectIssueList(projectId, params),
    enabled: Boolean(projectId),
  });
}

export function useProjectIssueDetail(projectId: string, issueId: string) {
  return useQuery({
    queryKey: projectsQueryKeys.issueDetail(projectId, issueId),
    queryFn: () => getProjectIssueDetail(projectId, issueId),
    enabled: Boolean(projectId) && Boolean(issueId),
  });
}

export function useProjectIssueFormDefaults(
  detail?: ProjectIssueDetail | null,
): ProjectIssueFormValues {
  return useMemo(() => {
    if (detail) {
      return mapProjectIssueDetailToFormValues(detail);
    }
    return buildProjectIssueFormDefaults();
  }, [detail]);
}

export function useCreateProjectIssue(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProjectIssueCreatePayload) =>
      createProjectIssue(projectId, payload),
    onSuccess: async () => {
      await invalidateProjectIssues(queryClient, projectId);
    },
  });
}

export function useUpdateProjectIssue(projectId: string, issueId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProjectIssueUpdatePayload) =>
      updateProjectIssue(projectId, issueId, payload),
    onSuccess: async () => {
      await invalidateProjectIssues(queryClient, projectId, issueId);
    },
  });
}

export function useDeleteProjectIssue(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (issueId: string) => deleteProjectIssue(projectId, issueId),
    onSuccess: async (_data, issueId) => {
      await invalidateProjectIssues(queryClient, projectId, issueId);
    },
  });
}

export function useProjectIssueComments(projectId: string, issueId: string) {
  return useQuery({
    queryKey: projectsQueryKeys.issueComments(projectId, issueId),
    queryFn: () =>
      getProjectIssueComments(projectId, issueId, { page_size: 100 }),
    enabled: Boolean(projectId) && Boolean(issueId),
  });
}

export function useCreateProjectIssueComment(
  projectId: string,
  issueId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProjectIssueCommentCreatePayload) =>
      createProjectIssueComment(projectId, issueId, payload),
    onSuccess: async () => {
      await invalidateProjectIssues(queryClient, projectId, issueId);
    },
  });
}

export function useDeleteProjectIssueComment(
  projectId: string,
  issueId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) =>
      deleteProjectIssueComment(projectId, issueId, commentId),
    onSuccess: async () => {
      await invalidateProjectIssues(queryClient, projectId, issueId);
    },
  });
}
