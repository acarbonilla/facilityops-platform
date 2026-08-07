import assert from "node:assert/strict";
import test from "node:test";

import {
  canTechnicianEditFullTaskForm,
  clampTechnicianProgressInput,
  formatTechnicianTaskStatusLabel,
  getAvailableTechnicianActions,
} from "./execution";
import { usesProjectWorkspaceMode } from "./workspace";

test("paused status displays as Paused for technicians", () => {
  assert.equal(formatTechnicianTaskStatusLabel("on_hold"), "Paused");
  assert.equal(formatTechnicianTaskStatusLabel("in_progress"), "In progress");
});

test("technician actions follow lifecycle gates", () => {
  assert.deepEqual(
    getAvailableTechnicianActions("not_started", {
      isAssignedToCurrentUser: true,
      canUpdate: true,
      isDependencyReady: true,
    }),
    ["start", "progress", "report_blocker"],
  );
  assert.deepEqual(
    getAvailableTechnicianActions("in_progress", {
      isAssignedToCurrentUser: true,
      canUpdate: true,
      isDependencyReady: true,
    }),
    ["pause", "complete", "progress", "report_blocker"],
  );
  assert.deepEqual(
    getAvailableTechnicianActions("on_hold", {
      isAssignedToCurrentUser: true,
      canUpdate: true,
      isDependencyReady: true,
    }),
    ["resume", "progress", "report_blocker", "complete"],
  );
  assert.deepEqual(
    getAvailableTechnicianActions("not_started", {
      isAssignedToCurrentUser: false,
      canUpdate: true,
      isDependencyReady: true,
    }),
    [],
  );
});

test("workspace mode hides full task form editing", () => {
  assert.equal(
    canTechnicianEditFullTaskForm({
      usesWorkspaceMode: true,
      hasPermission: () => true,
    }),
    false,
  );
  assert.equal(
    canTechnicianEditFullTaskForm({
      usesWorkspaceMode: false,
      hasPermission: (code) => code === "projects.tasks.update",
    }),
    true,
  );
});

test("progress clamp stays within 0-100", () => {
  assert.equal(clampTechnicianProgressInput(-5), 0);
  assert.equal(clampTechnicianProgressInput(140), 100);
  assert.equal(clampTechnicianProgressInput("42.6"), 43);
});

test("technician workspace mode detection", () => {
  assert.equal(
    usesProjectWorkspaceMode({
      roles: ["technician"],
      hasPermission: () => false,
    }),
    true,
  );
  assert.equal(
    usesProjectWorkspaceMode({
      roles: ["technician", "facility_manager"],
      hasPermission: () => false,
    }),
    false,
  );
  assert.equal(
    usesProjectWorkspaceMode({
      roles: ["technician"],
      hasPermission: (code) => code === "projects.manage",
    }),
    false,
  );
});
