import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReplaceUserRolesPayload,
  filterVisibleAssignableRoles,
  getInitialAssignedRoleIds,
  getTenantScopedOrganizations,
  getUserRoleSectionAccess,
  shouldShowUserTenantFilter,
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
  {
    id: "role-3",
    name: "Employee",
    code: "employee",
    description: "Employee requester",
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
  assert.deepEqual(getInitialAssignedRoleIds(roles), [
    "role-1",
    "role-2",
    "role-3",
  ]);
});

test("replacement payload contains unique selected role IDs", () => {
  assert.deepEqual(
    buildReplaceUserRolesPayload(["role-1", "role-1", " role-2 "]),
    { role_ids: ["role-1", "role-2"] },
  );
});

test("tenant-bound role options exclude system roles", () => {
  assert.deepEqual(filterVisibleAssignableRoles(roles, currentUser), [
    roles[0],
  ]);
});

test("tenant-bound system administrators keep system roles visible", () => {
  assert.deepEqual(
    filterVisibleAssignableRoles(roles, currentUser, ["system_admin"]),
    roles,
  );
});

test("global administrators preserve system roles in visible options", () => {
  assert.deepEqual(
    filterVisibleAssignableRoles(roles, { ...currentUser, tenant: null }),
    roles,
  );
});

test("tenant-bound users hide the tenant filter", () => {
  assert.equal(shouldShowUserTenantFilter("tenant-a"), false);
  assert.equal(shouldShowUserTenantFilter(null), true);
});

test("organization options stay within the authenticated tenant", () => {
  const organizations = [
    { id: "org-a", tenant: "tenant-a", name: "A" },
    { id: "org-b", tenant: "tenant-b", name: "B" },
  ];
  assert.deepEqual(getTenantScopedOrganizations(organizations, "tenant-a"), [
    organizations[0],
  ]);
  assert.deepEqual(
    getTenantScopedOrganizations(organizations, null),
    organizations,
  );
});
