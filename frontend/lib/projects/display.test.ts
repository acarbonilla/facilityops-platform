import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "@/services/api/types";

import {
  canCreateProject,
  canDeleteProject,
  canUpdateProject,
  formatProjectCompletion,
  formatProjectError,
  formatProjectPriorityLabel,
  formatProjectStatusLabel,
  getProjectListLayoutClasses,
} from "./display";

test("project status and priority labels are accessible display strings", () => {
  assert.equal(formatProjectStatusLabel("in_progress"), "In Progress");
  assert.equal(formatProjectStatusLabel("on_hold"), "On Hold");
  assert.equal(formatProjectPriorityLabel("critical"), "Critical");
  assert.equal(formatProjectPriorityLabel("medium"), "Medium");
});

test("completion percentage formats numeric and string values", () => {
  assert.equal(formatProjectCompletion(62), "62%");
  assert.equal(formatProjectCompletion("28.50"), "28.5%");
  assert.equal(formatProjectCompletion(null), "0%");
});

test("project permission helpers require create/update/delete or manage", () => {
  const allow = (codes: string[]) => (code: string) => codes.includes(code);

  assert.equal(canCreateProject(allow(["projects.create"])), true);
  assert.equal(canCreateProject(allow(["projects.manage"])), true);
  assert.equal(canCreateProject(allow(["projects.view"])), false);

  assert.equal(canUpdateProject(allow(["projects.update"])), true);
  assert.equal(canUpdateProject(allow(["projects.view"])), false);

  assert.equal(canDeleteProject(allow(["projects.delete"])), true);
  assert.equal(canDeleteProject(allow(["projects.manage"])), true);
  assert.equal(canDeleteProject(allow(["projects.view"])), false);
});

test("mobile list layout helpers expose table and card wrappers", () => {
  const classes = getProjectListLayoutClasses();
  assert.match(classes.tableWrapper, /hidden/);
  assert.match(classes.tableWrapper, /md:block/);
  assert.match(classes.cardsWrapper, /md:hidden/);
});

test("formatProjectError preserves field-specific backend validation", () => {
  const error = new ApiError("Validation failed", 400, {
    message: "Validation failed",
    errors: {
      organization: ["Organization is required."],
    },
  });

  assert.equal(
    formatProjectError(error, "Fallback"),
    "Organization: Organization is required.",
  );
});
