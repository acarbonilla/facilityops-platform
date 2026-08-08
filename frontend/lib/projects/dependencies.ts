/**
 * FO-105 dependency form validation, readiness copy, and connector mapping.
 */

import type {
  ProjectGanttDependency,
  ProjectTaskBlockingPredecessor,
  ProjectTaskDependency,
  ProjectTaskDependencyReadiness,
} from "@/types/projects";

export interface DependencyFormValues {
  predecessorTask: string;
  successorTask: string;
}

export interface DependencyFormValidation {
  valid: boolean;
  errors: string[];
}

export interface DependencyConnector {
  id: string;
  predecessorTaskId: string;
  successorTaskId: string;
  dependencyType: string;
}

export function validateDependencyForm(
  values: DependencyFormValues,
): DependencyFormValidation {
  const errors: string[] = [];
  const predecessor = values.predecessorTask.trim();
  const successor = values.successorTask.trim();

  if (!predecessor) {
    errors.push("Select a predecessor task.");
  }
  if (!successor) {
    errors.push("Select a successor task.");
  }
  if (predecessor && successor && predecessor === successor) {
    errors.push("A task cannot depend on itself.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function mapDependencyConnectors(
  dependencies: Array<
    | ProjectTaskDependency
    | ProjectGanttDependency
    | {
        id: string;
        predecessor_task?: string;
        successor_task?: string;
        predecessor_task_id?: string;
        successor_task_id?: string;
        dependency_type: string;
      }
  >,
): DependencyConnector[] {
  return dependencies.map((dep) => {
    const predecessorTaskId =
      "predecessor_task_id" in dep && dep.predecessor_task_id
        ? dep.predecessor_task_id
        : "predecessor_task" in dep && dep.predecessor_task
          ? dep.predecessor_task
          : "";
    const successorTaskId =
      "successor_task_id" in dep && dep.successor_task_id
        ? dep.successor_task_id
        : "successor_task" in dep && dep.successor_task
          ? dep.successor_task
          : "";

    return {
      id: dep.id,
      predecessorTaskId,
      successorTaskId,
      dependencyType: dep.dependency_type,
    };
  });
}

export function formatDependencyReadinessMessage(
  readiness:
    | Pick<
        ProjectTaskDependencyReadiness,
        | "is_dependency_ready"
        | "blocking_predecessor_count"
        | "blocking_predecessors"
        | "predecessor_count"
      >
    | null
    | undefined,
): string {
  if (!readiness) {
    return "Dependency readiness unavailable.";
  }

  if (readiness.predecessor_count === 0) {
    return "No predecessors — ready to start.";
  }

  if (readiness.is_dependency_ready) {
    return `Ready — all ${readiness.predecessor_count} predecessor${
      readiness.predecessor_count === 1 ? "" : "s"
    } completed.`;
  }

  const count = readiness.blocking_predecessor_count;
  const codes = (readiness.blocking_predecessors ?? [])
    .map((item: ProjectTaskBlockingPredecessor) => item.task_code)
    .filter(Boolean);
  const codesSuffix =
    codes.length > 0 ? ` (${codes.slice(0, 3).join(", ")}${codes.length > 3 ? "…" : ""})` : "";

  return `Blocked by ${count} incomplete predecessor${
    count === 1 ? "" : "s"
  }${codesSuffix}.`;
}

export function summarizeDependencyLinks(
  codes: string[],
  emptyLabel = "None",
): string {
  if (codes.length === 0) {
    return emptyLabel;
  }
  if (codes.length <= 3) {
    return codes.join(", ");
  }
  return `${codes.slice(0, 3).join(", ")} +${codes.length - 3} more`;
}

export function canViewProjectGantt(
  hasPermission: (code: string) => boolean,
) {
  return (
    hasPermission("projects.gantt.view") ||
    hasPermission("projects.view") ||
    hasPermission("projects.manage")
  );
}

export function canManageProjectDependencies(
  hasPermission: (code: string) => boolean,
) {
  return (
    hasPermission("projects.dependencies.manage") ||
    hasPermission("projects.manage") ||
    hasPermission("projects.tasks.manage")
  );
}
