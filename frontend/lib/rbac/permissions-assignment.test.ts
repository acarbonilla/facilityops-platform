import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReplaceRolePermissionsPayload,
  clearAllVisible,
  groupPermissionsByModule,
  initializeAssignedPermissionSelection,
  searchPermissions,
  selectAllVisible,
} from "./permissions-assignment";

const permissions = [
  {
    id: "1",
    name: "View Users",
    code: "users.view",
    module: "users",
    action: "view",
    description: "View user records",
    is_active: true,
  },
  {
    id: "2",
    name: "Update Users",
    code: "users.update",
    module: "users",
    action: "update",
    description: "Edit user records",
    is_active: true,
  },
  {
    id: "3",
    name: "View Assets",
    code: "assets.view",
    module: "assets",
    action: "view",
    description: "Read assets",
    is_active: true,
  },
];

test("assigned permission IDs initialize selection", () => {
  const selected = initializeAssignedPermissionSelection([permissions[0], permissions[2]]);
  assert.deepEqual(Array.from(selected), ["1", "3"]);
});

test("replacement payload contains unique permission IDs", () => {
  const payload = buildReplaceRolePermissionsPayload(["1", "2", "2", "3"]);
  assert.deepEqual(payload, { permission_ids: ["1", "2", "3"] });
});

test("permission grouping is stable by module", () => {
  const grouped = groupPermissionsByModule([permissions[0], permissions[2], permissions[1]]);
  assert.deepEqual(grouped.map((group) => group.module), ["assets", "users"]);
  assert.deepEqual(grouped[1]?.permissions.map((permission) => permission.code), [
    "users.update",
    "users.view",
  ]);
});

test("permission search matches name code module action and description", () => {
  assert.equal(searchPermissions(permissions, "update users").length, 1);
  assert.equal(searchPermissions(permissions, "assets.view").length, 1);
  assert.equal(searchPermissions(permissions, "users").length, 2);
  assert.equal(searchPermissions(permissions, "view").length, 2);
  assert.equal(searchPermissions(permissions, "read assets").length, 1);
});

test("select all visible affects visible permissions only", () => {
  const selected = selectAllVisible(new Set(["1"]), [permissions[1], permissions[2]]);
  assert.deepEqual(Array.from(selected).sort(), ["1", "2", "3"]);
});

test("clear all visible preserves filtered out selections", () => {
  const selected = clearAllVisible(new Set(["1", "2", "3"]), [permissions[1]]);
  assert.deepEqual(Array.from(selected).sort(), ["1", "3"]);
});

test("an empty selection produces an empty permission_ids array", () => {
  const payload = buildReplaceRolePermissionsPayload(new Set<string>());
  assert.deepEqual(payload, { permission_ids: [] });
});
