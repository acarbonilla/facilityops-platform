import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "@/services/api/types";

import {
  canCommentOnProjectIssue,
  canManageProjectIssues,
  canViewProjectIssues,
  formatProjectIssueSeverityLabel,
  formatProjectIssueStatusLabel,
  formatProjectIssueError,
  getProjectIssueListLayoutClasses,
} from "./issues-display";

test("issue severity and status labels are accessible display strings", () => {
  assert.equal(formatProjectIssueSeverityLabel("critical"), "Critical");
  assert.equal(formatProjectIssueSeverityLabel("medium"), "Medium");
  assert.equal(formatProjectIssueStatusLabel("open"), "Open");
  assert.equal(formatProjectIssueStatusLabel("investigating"), "Investigating");
  assert.equal(formatProjectIssueStatusLabel("resolved"), "Resolved");
});

test("issue permission helpers require issues or manage codes", () => {
  const allow = (codes: string[]) => (code: string) => codes.includes(code);

  assert.equal(canViewProjectIssues(allow(["projects.issues.view"])), true);
  assert.equal(canViewProjectIssues(allow(["projects.view"])), true);
  assert.equal(canViewProjectIssues(allow(["projects.create"])), false);

  assert.equal(canManageProjectIssues(allow(["projects.issues.manage"])), true);
  assert.equal(canManageProjectIssues(allow(["projects.manage"])), true);
  assert.equal(canManageProjectIssues(allow(["projects.issues.view"])), false);

  assert.equal(
    canCommentOnProjectIssue(allow(["projects.issues.comment"])),
    true,
  );
  assert.equal(
    canCommentOnProjectIssue(allow(["projects.issues.manage"])),
    true,
  );
  assert.equal(canCommentOnProjectIssue(allow(["projects.issues.view"])), false);
});

test("mobile issue list layout helpers expose table and card wrappers", () => {
  const classes = getProjectIssueListLayoutClasses();
  assert.match(classes.tableWrapper, /hidden/);
  assert.match(classes.tableWrapper, /md:block/);
  assert.match(classes.cardsWrapper, /md:hidden/);
});

test("issue error formatting handles forbidden responses", () => {
  assert.match(
    formatProjectIssueError(new ApiError("forbidden", 403), "fallback"),
    /permission/i,
  );
});
