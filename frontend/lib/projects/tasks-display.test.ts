import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "@/services/api/types";

import {
  canAssignProjectTask,
  canCreateProjectTask,
  canDeleteProjectTask,
  canUpdateProjectTask,
  canViewProjectTasks,
  formatProjectTaskError,
  formatProjectTaskPriorityLabel,
  formatProjectTaskProgress,
  formatProjectTaskStatusLabel,
  formatProjectTaskSummaryCounts,
  formatTaskPlannedScheduleLabel,
  getProjectTaskListLayoutClasses,
  isTaskRelatedHistoryAction,
  isTaskScheduleUnscheduled,
} from "./tasks-display";

test("task status and priority labels are accessible display strings", () => {
  assert.equal(formatProjectTaskStatusLabel("not_started"), "Not Started");
  assert.equal(formatProjectTaskStatusLabel("in_progress"), "In Progress");
  assert.equal(formatProjectTaskStatusLabel("blocked"), "Blocked");
  assert.equal(formatProjectTaskPriorityLabel("critical"), "Critical");
  assert.equal(formatProjectTaskPriorityLabel("medium"), "Medium");
});

test("task progress formats numeric and string values", () => {
  assert.equal(formatProjectTaskProgress(62), "62%");
  assert.equal(formatProjectTaskProgress("28.50"), "28.5%");
  assert.equal(formatProjectTaskProgress(null), "0%");
});

test("task summary counts include all FO-104 statuses", () => {
  const counts = formatProjectTaskSummaryCounts({
    total: 10,
    not_started: 2,
    in_progress: 3,
    blocked: 1,
    on_hold: 1,
    completed: 2,
    cancelled: 1,
  });

  assert.equal(counts.length, 7);
  assert.equal(counts[0]?.label, "Total");
  assert.equal(counts[0]?.value, 10);
  assert.equal(counts.find((row) => row.label === "Blocked")?.value, 1);
});

test("task permission helpers require task or manage codes", () => {
  const allow = (codes: string[]) => (code: string) => codes.includes(code);

  assert.equal(canViewProjectTasks(allow(["projects.tasks.view"])), true);
  assert.equal(canViewProjectTasks(allow(["projects.view"])), true);
  assert.equal(canViewProjectTasks(allow(["projects.create"])), false);

  assert.equal(canCreateProjectTask(allow(["projects.tasks.create"])), true);
  assert.equal(canCreateProjectTask(allow(["projects.manage"])), true);
  assert.equal(canCreateProjectTask(allow(["projects.view"])), false);

  assert.equal(canUpdateProjectTask(allow(["projects.tasks.update"])), true);
  assert.equal(canDeleteProjectTask(allow(["projects.tasks.delete"])), true);
  assert.equal(canAssignProjectTask(allow(["projects.tasks.assign"])), true);
});

test("mobile task list layout helpers expose table and card wrappers", () => {
  const classes = getProjectTaskListLayoutClasses();
  assert.match(classes.tableWrapper, /hidden/);
  assert.match(classes.tableWrapper, /md:block/);
  assert.match(classes.cardsWrapper, /md:hidden/);
});

test("task history filter recognizes task-related actions", () => {
  assert.equal(isTaskRelatedHistoryAction("task_created"), true);
  assert.equal(isTaskRelatedHistoryAction("task_assigned"), true);
  assert.equal(isTaskRelatedHistoryAction("checklist_updated"), true);
  assert.equal(isTaskRelatedHistoryAction("project_updated"), false);
});

test("formatProjectTaskError preserves field-specific backend validation", () => {
  const error = new ApiError("Validation failed", 400, {
    message: "Validation failed",
    errors: {
      person_in_charge: ["Person in charge is required."],
    },
  });

  assert.equal(
    formatProjectTaskError(error, "Fallback"),
    "Person in charge: Person in charge is required.",
  );
});

test("FO-114 schedule labels distinguish unscheduled, same-day, and milestone", () => {
  assert.equal(
    formatTaskPlannedScheduleLabel({
      planned_start: null,
      planned_end: null,
    }),
    "Unscheduled",
  );
  assert.equal(
    formatTaskPlannedScheduleLabel({
      planned_start: "2026-08-10",
      planned_end: "2026-08-10",
      is_milestone: false,
    }),
    "2026-08-10",
  );
  assert.equal(
    formatTaskPlannedScheduleLabel({
      planned_start: "2026-08-11",
      planned_end: "2026-08-12",
    }),
    "2026-08-11 – 2026-08-12",
  );
  assert.equal(
    formatTaskPlannedScheduleLabel({
      planned_start: "2026-08-14",
      planned_end: "2026-08-14",
      is_milestone: true,
    }),
    "2026-08-14",
  );
  assert.equal(
    isTaskScheduleUnscheduled({ planned_start: null, planned_end: null }),
    true,
  );
  assert.equal(
    isTaskScheduleUnscheduled({
      planned_start: "2026-08-10",
      planned_end: "2026-08-10",
    }),
    false,
  );
});

test("FO-114 dependency schedule conflict errors render clearly", () => {
  const error = new ApiError("Validation failed", 400, {
    message: "Validation failed",
    errors: {
      task_schedule_dependency_conflict: [
        "task_schedule_dependency_conflict: successor planned start (2026-08-11) is before predecessor planned end (2026-08-12) for Finish-to-Start dependency T-1 → T-2.",
      ],
    },
  });

  assert.match(
    formatProjectTaskError(error, "Fallback"),
    /task_schedule_dependency_conflict/i,
  );
});
