import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReplaceUserRolesPayload,
  filterVisibleAssignableRoles,
  getInitialAssignedRoleIds,
  getUserRoleSectionAccess,
} from "./roles";

const currentUser = {
  id: "current",
  email: "current@example.com",
  first_name: "",
  last_name: "",
  tenant: "tenant-a",
  organization: null,
  is_staff: false,
};

const roles = [
  {
    id: "role-1",
    name: "Inspector",
    code: "inspector",
    description: "Inspection role",
    is_system_role: false,
  },
  {
    id: "role-2",
    name: "System Administrator",
    code: "system_admin",
    description: "System role",
    is_system_role: true,
  },
];

test("role-section helper requires users.view and roles.view", () => {
  assert.deepEqual(
    getUserRoleSectionAccess(["users.view", "roles.view"], currentUser),
    { canViewRoles: true, canManageRoles: false },
  );
});

test("read-only users cannot receive a manage-roles action", () => {
  assert.equal(
    getUserRoleSectionAccess(["users.view", "roles.view"], currentUser)
      .canManageRoles,
    false,
  );
});

test("assigned roles initialize the editable selection", () => {
  assert.deepEqual(getInitialAssignedRoleIds(roles), ["role-1", "role-2"]);
});

test("replacement payload contains unique selected role IDs", () => {
  assert.deepEqual(
    buildReplaceUserRolesPayload(["role-1", "role-1", " role-2 "]),
    { role_ids: ["role-1", "role-2"] },
  );
});

test("tenant-bound role options exclude system roles", () => {
  assert.deepEqual(filterVisibleAssignableRoles(roles, currentUser), [roles[0]]);
});

test("global administrators preserve system roles in visible options", () => {
  assert.deepEqual(
    filterVisibleAssignableRoles(roles, { ...currentUser, tenant: null }),
    roles,
  );
});