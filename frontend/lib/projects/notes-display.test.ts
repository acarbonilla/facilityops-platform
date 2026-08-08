import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "@/services/api/types";

import {
  canManageProjectNotes,
  canViewProjectNotes,
  formatProjectNoteCategoryLabel,
  formatProjectNoteError,
  getProjectNoteListLayoutClasses,
} from "./notes-display";

test("note category labels cover FO-106 categories", () => {
  assert.equal(formatProjectNoteCategoryLabel("general"), "General");
  assert.equal(formatProjectNoteCategoryLabel("meeting"), "Meeting");
  assert.equal(formatProjectNoteCategoryLabel("safety"), "Safety");
  assert.equal(formatProjectNoteCategoryLabel("contractor"), "Contractor");
});

test("note permission helpers require notes or manage codes", () => {
  const allow = (codes: string[]) => (code: string) => codes.includes(code);

  assert.equal(canViewProjectNotes(allow(["projects.notes.view"])), true);
  assert.equal(canViewProjectNotes(allow(["projects.view"])), true);
  assert.equal(canViewProjectNotes(allow(["projects.create"])), false);

  assert.equal(canManageProjectNotes(allow(["projects.notes.manage"])), true);
  assert.equal(canManageProjectNotes(allow(["projects.manage"])), true);
  assert.equal(canManageProjectNotes(allow(["projects.notes.view"])), false);
});

test("mobile note list layout helpers expose table and card wrappers", () => {
  const classes = getProjectNoteListLayoutClasses();
  assert.match(classes.tableWrapper, /hidden/);
  assert.match(classes.tableWrapper, /md:block/);
  assert.match(classes.cardsWrapper, /md:hidden/);
});

test("note error formatting handles forbidden responses", () => {
  assert.match(
    formatProjectNoteError(new ApiError("forbidden", 403), "fallback"),
    /permission/i,
  );
});
