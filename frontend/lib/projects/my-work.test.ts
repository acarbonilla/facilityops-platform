import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessMyWorkNav,
  emptyMyWorkMessage,
  formatBlockReasonLabel,
  formatDelayDaysLabel,
  formatMyWorkProgress,
  getMyWorkQuickActions,
  summarizeMyWorkCards,
} from "./my-work";

test("canAccessMyWorkNav requires technician workspace mode", () => {
  assert.equal(
    canAccessMyWorkNav({
      roles: ["technician"],
      hasPermission: (code) => code === "projects.view",
    }),
    true,
  );
  assert.equal(
    canAccessMyWorkNav({
      roles: ["facility_manager"],
      hasPermission: (code) =>
        code === "projects.view" || code === "projects.manage",
    }),
    false,
  );
  assert.equal(
    canAccessMyWorkNav({
      roles: ["employee"],
      hasPermission: () => false,
    }),
    false,
  );
});

test("summarizeMyWorkCards exposes focused summary metrics", () => {
  const cards = summarizeMyWorkCards({
    my_projects: 2,
    my_assigned_tasks: 5,
    in_progress: 1,
    overdue: 1,
    due_today: 1,
    due_this_week: 2,
    blocked_or_paused: 1,
    status_blocked: 0,
    paused: 1,
    dependency_blocked: 0,
    completed_recently: 3,
    unscheduled: 1,
    upcoming: 2,
  });
  assert.equal(cards.length, 8);
  assert.equal(cards[0]?.label, "My Projects");
  assert.equal(cards[3]?.value, 1);
});

test("quick actions hide unauthorized and completion", () => {
  const none = getMyWorkQuickActions(
    { status: "in_progress", is_dependency_ready: true },
    { isAssignedToCurrentUser: false, canUpdate: true },
  );
  assert.deepEqual(none, []);

  const actions = getMyWorkQuickActions(
    { status: "in_progress", is_dependency_ready: true },
    { isAssignedToCurrentUser: true, canUpdate: true },
  );
  assert.ok(actions.includes("pause"));
  assert.equal(actions.includes("complete"), false);
});

test("empty states use non-judgmental copy", () => {
  assert.match(emptyMyWorkMessage("projects").message, /don't have any assigned/i);
  assert.match(emptyMyWorkMessage("overdue").message, /up to date/i);
  assert.match(emptyMyWorkMessage("today").message, /scheduled for today/i);
});

test("progress and overdue labels are text-accessible", () => {
  assert.equal(formatMyWorkProgress("42.00"), "42%");
  assert.equal(formatDelayDaysLabel(3), "3 days overdue");
  assert.equal(formatBlockReasonLabel("waiting_predecessor"), "Waiting for predecessor");
  assert.equal(formatBlockReasonLabel("paused"), "Paused");
});
