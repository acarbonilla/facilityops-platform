import assert from "node:assert/strict";
import test from "node:test";

import {
  canManageProjectDependencies,
  canViewProjectGantt,
  formatDependencyReadinessMessage,
  mapDependencyConnectors,
  summarizeDependencyLinks,
  validateDependencyForm,
} from "./dependencies";

test("validateDependencyForm rejects missing and self dependencies", () => {
  assert.equal(
    validateDependencyForm({ predecessorTask: "", successorTask: "b" }).valid,
    false,
  );
  assert.equal(
    validateDependencyForm({ predecessorTask: "a", successorTask: "" }).valid,
    false,
  );
  const self = validateDependencyForm({
    predecessorTask: "same",
    successorTask: "same",
  });
  assert.equal(self.valid, false);
  assert.match(self.errors.join(" "), /itself/i);

  assert.equal(
    validateDependencyForm({ predecessorTask: "a", successorTask: "b" }).valid,
    true,
  );
});

test("mapDependencyConnectors normalizes list and gantt shapes", () => {
  const fromList = mapDependencyConnectors([
    {
      id: "d1",
      tenant: "t",
      project: "p",
      predecessor_task: "a",
      predecessor_task_code: "T-A",
      successor_task: "b",
      successor_task_code: "T-B",
      dependency_type: "finish_to_start",
      created_at: "",
      updated_at: "",
    },
  ]);
  assert.deepEqual(fromList[0], {
    id: "d1",
    predecessorTaskId: "a",
    successorTaskId: "b",
    dependencyType: "finish_to_start",
  });

  const fromGantt = mapDependencyConnectors([
    {
      id: "d2",
      predecessor_task_id: "x",
      successor_task_id: "y",
      dependency_type: "finish_to_start",
    },
  ]);
  assert.equal(fromGantt[0]?.predecessorTaskId, "x");
  assert.equal(fromGantt[0]?.successorTaskId, "y");
});

test("formatDependencyReadinessMessage describes ready and blocked states", () => {
  assert.match(
    formatDependencyReadinessMessage({
      is_dependency_ready: true,
      blocking_predecessor_count: 0,
      blocking_predecessors: [],
      predecessor_count: 0,
    }),
    /No predecessors/i,
  );

  assert.match(
    formatDependencyReadinessMessage({
      is_dependency_ready: true,
      blocking_predecessor_count: 0,
      blocking_predecessors: [],
      predecessor_count: 2,
    }),
    /Ready/i,
  );

  assert.match(
    formatDependencyReadinessMessage({
      is_dependency_ready: false,
      blocking_predecessor_count: 1,
      blocking_predecessors: [
        {
          id: "1",
          task_code: "T-001",
          name: "Prep",
          status: "in_progress",
          planned_end: null,
        },
      ],
      predecessor_count: 1,
    }),
    /Blocked by 1 incomplete predecessor \(T-001\)/,
  );
});

test("summarizeDependencyLinks truncates long lists", () => {
  assert.equal(summarizeDependencyLinks([]), "None");
  assert.equal(summarizeDependencyLinks(["A", "B"]), "A, B");
  assert.equal(
    summarizeDependencyLinks(["A", "B", "C", "D"]),
    "A, B, C +1 more",
  );
});

test("gantt and dependency permission helpers accept manage aliases", () => {
  const allow = (codes: string[]) => (code: string) => codes.includes(code);

  assert.equal(canViewProjectGantt(allow(["projects.gantt.view"])), true);
  assert.equal(canViewProjectGantt(allow(["projects.view"])), true);
  assert.equal(canViewProjectGantt(allow(["projects.manage"])), true);
  assert.equal(canViewProjectGantt(allow(["projects.tasks.view"])), false);

  assert.equal(
    canManageProjectDependencies(allow(["projects.dependencies.manage"])),
    true,
  );
  assert.equal(
    canManageProjectDependencies(allow(["projects.tasks.manage"])),
    true,
  );
  assert.equal(
    canManageProjectDependencies(allow(["projects.gantt.view"])),
    false,
  );
});
